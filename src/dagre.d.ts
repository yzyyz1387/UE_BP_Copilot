declare module 'dagre' {
  const dagre: {
    graphlib: {
      Graph: new () => {
        setGraph(value: Record<string, unknown>): void;
        setDefaultEdgeLabel(callback: () => Record<string, unknown>): void;
        setNode(id: string, value: { width: number; height: number }): void;
        setEdge(source: string, target: string): void;
        node(id: string): { x: number; y: number; width: number; height: number };
      };
    };
    layout(graph: unknown): void;
  };

  export default dagre;
}
