import { useEffect, useMemo } from 'react';
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
  const computedNodes = useMemo(
    () => toFlowNodes(plan, selectedNodeId),
    [plan, selectedNodeId],
  );
  const computedEdges = useMemo(() => toFlowEdges(plan), [plan]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  useEffect(() => {
    setNodes(computedNodes);
  }, [computedNodes, setNodes]);

  useEffect(() => {
    setEdges(computedEdges);
  }, [computedEdges, setEdges]);

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
