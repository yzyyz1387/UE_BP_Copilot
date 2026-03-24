import { useEffect, useRef, useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { toFlowEdges, toFlowNodes } from '../lib/blueprintTransform';
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
  const initialNodes = useMemo(() => toFlowNodes(plan, selectedNodeId), []);
  const initialEdges = useMemo(() => toFlowEdges(plan), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Reset nodes+edges only when the plan itself changes (new generation / import)
  useEffect(() => {
    if (planRef.current === plan) return;
    planRef.current = plan;
    setNodes(toFlowNodes(plan, selectedNodeId));
    setEdges(toFlowEdges(plan));
  }, [plan]);

  // When selection changes, only update the `selected` flag — preserve positions
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: { ...n.data, selected: n.id === selectedNodeId },
      })),
    );
  }, [selectedNodeId]);

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
        onNodesChange={onNodesChange}
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
