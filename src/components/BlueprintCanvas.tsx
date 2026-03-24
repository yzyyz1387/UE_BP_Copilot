import { useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type NodeChange,
} from '@xyflow/react';
import { toFlowEdges, toFlowNodes, autoLayoutNodes } from '../lib/blueprintTransform';
import { loadStoredPositions, storePositions } from '../lib/localStorage';
import type { BlueprintPlan } from '../types';
import BlueprintNode from './BlueprintNode';

const nodeTypes = {
  blueprintNode: BlueprintNode,
};

interface BlueprintCanvasProps {
  plan: BlueprintPlan;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

export function BlueprintCanvas({
  plan,
  selectedNodeId,
  onSelectNode,
}: BlueprintCanvasProps) {
  const planRef = useRef(plan);
  
  const initialNodes = useMemo(() => {
    const baseNodes = toFlowNodes(plan, selectedNodeId);
    const edges = toFlowEdges(plan);
    const storedPositions = loadStoredPositions();

    // Apply stored positions if available
    if (storedPositions) {
      const withStoredPos = baseNodes.map((n) =>
        storedPositions[n.id] ? { ...n, position: storedPositions[n.id] } : n,
      );
      // Check if all nodes have valid stored positions
      const allHaveStored = withStoredPos.every((n) => storedPositions[n.id]);
      if (allHaveStored) return withStoredPos;
    }

    // Otherwise auto-layout
    return autoLayoutNodes(baseNodes, edges);
  }, []);

  const initialEdges = useMemo(() => toFlowEdges(plan), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Reset nodes+edges when plan changes (new generation / import)
  useEffect(() => {
    if (planRef.current === plan) return;
    planRef.current = plan;
    
    const baseNodes = toFlowNodes(plan, selectedNodeId);
    const newEdges = toFlowEdges(plan);
    const storedPositions = loadStoredPositions();

    let finalNodes = baseNodes;
    if (storedPositions) {
      finalNodes = baseNodes.map((n) =>
        storedPositions[n.id] ? { ...n, position: storedPositions[n.id] } : n,
      );
      const allHaveStored = finalNodes.every((n) => storedPositions[n.id]);
      if (!allHaveStored) {
        finalNodes = autoLayoutNodes(baseNodes, newEdges);
      }
    } else {
      finalNodes = autoLayoutNodes(baseNodes, newEdges);
    }

    setNodes(finalNodes);
    setEdges(newEdges);
  }, [plan, selectedNodeId, setNodes, setEdges]);

  // When selection changes, only update the `selected` flag
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: { ...n.data, selected: n.id === selectedNodeId },
      })),
    );
  }, [selectedNodeId, setNodes]);

  // Persist positions when nodes are dragged
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      
      // Extract position changes and persist
      const positionChanges = changes.filter(
        (c) => c.type === 'position' && c.dragging === false && c.position,
      );
      
      if (positionChanges.length > 0) {
        setNodes((currentNodes) => {
          const positions: Record<string, { x: number; y: number }> = {};
          currentNodes.forEach((n) => {
            positions[n.id] = n.position;
          });
          storePositions(positions);
          return currentNodes;
        });
      }
    },
    [onNodesChange, setNodes],
  );

  return (
    <div className="canvas-shell">
      <div className="canvas-shell__overlay">
        <div className="glass-card glass-card--summary">
          <strong>{plan.meta.title}</strong>
          <p>{plan.meta.summary}</p>
          <span className="canvas-hint">滚轮缩放 · 按住左键拖动画布 · 点击节点看详情</span>
        </div>

        <div className="glass-card glass-card--stats">
          <span>{plan.meta.blueprintType}</span>
          <span>{plan.nodes.length} 节点</span>
          <span>{plan.links.length} 连线</span>
          <span>{plan.variables.length} 变量</span>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(null)}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.25}
        maxZoom={2.2}
        nodesConnectable={false}
        zoomOnScroll
        panOnScroll={false}
        panOnDrag
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} />
        <MiniMap zoomable pannable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
