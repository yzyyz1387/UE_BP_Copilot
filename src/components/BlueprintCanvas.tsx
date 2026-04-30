import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Node,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react';
import {
  toFlowEdges,
  toFlowNodes,
  autoLayoutNodes,
  getNodeColorByAccent,
  getNodeAccent,
} from '../lib/blueprintTransform';
import { loadStoredPositions, storePositions } from '../lib/localStorage';
import type { BlueprintFlowNodeData, BlueprintPlan } from '../types';
import BlueprintNode from './BlueprintNode';

type BlueprintReactFlowNode = Node<BlueprintFlowNodeData>;

const nodeTypes = {
  blueprintNode: BlueprintNode,
} as NodeTypes;

interface BlueprintCanvasProps {
  plan: BlueprintPlan;
  selectedNodeId: string | null;
  storageScope?: string;
  onSelectNode: (nodeId: string | null) => void;
}

function buildNodes(plan: BlueprintPlan, selectedNodeId: string | null, storageScope?: string): BlueprintReactFlowNode[] {
  const baseNodes = toFlowNodes(plan, selectedNodeId);
  const edges = toFlowEdges(plan);
  const storedPositions = loadStoredPositions(storageScope);

  if (storedPositions) {
    const withStoredPos = baseNodes.map((n) =>
      storedPositions[n.id] ? { ...n, position: storedPositions[n.id] } : n,
    );
    const allHaveStored = withStoredPos.every((n) => storedPositions[n.id]);
    if (allHaveStored) return withStoredPos;
  }

  return autoLayoutNodes(baseNodes, edges);
}

export function BlueprintCanvas({
  plan,
  selectedNodeId,
  storageScope,
  onSelectNode,
}: BlueprintCanvasProps) {
  const planRef = useRef(plan);
  const scopeRef = useRef(storageScope);
  const [canvasLocked, setCanvasLocked] = useState(false);

  const initialNodes = useMemo(
    () => buildNodes(plan, selectedNodeId, storageScope),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const initialEdges = useMemo(() => toFlowEdges(plan), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<BlueprintReactFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    if (planRef.current === plan && scopeRef.current === storageScope) return;
    planRef.current = plan;
    scopeRef.current = storageScope;
    setNodes(buildNodes(plan, selectedNodeId, storageScope));
    setEdges(toFlowEdges(plan));
  }, [plan, storageScope, selectedNodeId, setNodes, setEdges]);

  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: { ...n.data, selected: n.id === selectedNodeId },
      })),
    );
  }, [selectedNodeId, setNodes]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<BlueprintReactFlowNode>[]) => {
      if (canvasLocked) return;
      onNodesChange(changes);

      const positionChanges = changes.filter(
        (c) => c.type === 'position' && c.dragging === false && c.position,
      );

      if (positionChanges.length > 0) {
        setNodes((currentNodes) => {
          const positions: Record<string, { x: number; y: number }> = {};
          currentNodes.forEach((n) => {
            positions[n.id] = n.position;
          });
          storePositions(positions, storageScope);
          return currentNodes;
        });
      }
    },
    [canvasLocked, onNodesChange, setNodes, storageScope],
  );

  return (
    <div className={`canvas-shell ${canvasLocked ? 'is-locked' : ''}`}>
      <div className="canvas-shell__overlay">
        <div className="glass-card glass-card--summary">
          <strong>{plan.meta.title}</strong>
          <p>{plan.meta.summary}</p>
          <span className="canvas-hint">滚轮缩放 · 左键拖动画布 · 点击节点看详情</span>
        </div>

        <div className="glass-card glass-card--stats">
          <span>{plan.meta.blueprintType}</span>
          <span>{plan.nodes.length} 节点</span>
          <span>{plan.links.length} 连线</span>
          <span>{plan.variables.length} 用户变量</span>
          <span>{plan.properties.length} 属性</span>
        </div>
      </div>

      <button
        type="button"
        className={`canvas-lock-button ${canvasLocked ? 'is-active' : ''}`}
        onClick={() => setCanvasLocked((value) => !value)}
        title={canvasLocked ? '已锁定：禁止拖动、缩放、选择' : '未锁定：允许拖动、缩放、选择'}
      >
        <span>{canvasLocked ? '🔒' : '🔓'}</span>
        <em>{canvasLocked ? '已锁定' : '可编辑'}</em>
      </button>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={canvasLocked ? undefined : onEdgesChange}
        onNodeClick={canvasLocked ? undefined : (_, node) => onSelectNode(node.id)}
        onPaneClick={canvasLocked ? undefined : () => onSelectNode(null)}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.25}
        maxZoom={2.2}
        nodesDraggable={!canvasLocked}
        nodesConnectable={false}
        elementsSelectable={!canvasLocked}
        zoomOnScroll={!canvasLocked}
        zoomOnPinch={!canvasLocked}
        zoomOnDoubleClick={!canvasLocked}
        panOnScroll={false}
        panOnDrag={!canvasLocked}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} />
        <MiniMap
          zoomable={!canvasLocked}
          pannable={!canvasLocked}
          nodeColor={(node) => {
            const data = node.data as unknown as BlueprintFlowNodeData;
            return getNodeColorByAccent(getNodeAccent(data.nodeType, data.category));
          }}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
