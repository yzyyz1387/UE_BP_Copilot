import type { Edge, Node } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import dagre from 'dagre';
import type {
  AdviceLevel,
  BlueprintFlowNodeData,
  BlueprintLink,
  BlueprintNodeKind,
  BlueprintNodeModel,
  BlueprintPlan,
  BlueprintVariable,
  Pin,
  SearchTip,
} from '../types';

const ALLOWED_NODE_TYPES = new Set<BlueprintNodeKind>([
  'event',
  'function',
  'macro',
  'variable',
  'comment',
  'custom',
]);

const ALLOWED_LEVELS = new Set<AdviceLevel>(['note', 'warning', 'tip']);

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function uniqueStrings(values: unknown, limit = 8): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const output: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const text = value.trim();
    if (!text || output.includes(text)) {
      continue;
    }

    output.push(text);
    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function sanitizePins(value: unknown, prefix: string): Pin[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const pin = (item ?? {}) as Partial<Pin>;
    const kind = pin.kind === 'exec' ? 'exec' : 'data';

    return {
      id: stringValue(pin.id, `${prefix}_${index}`),
      label: stringValue(pin.label, kind === 'exec' ? 'Exec' : `Pin ${index + 1}`),
      kind,
      dataType: stringValue(pin.dataType, kind === 'exec' ? 'Exec' : 'Any'),
    };
  });
}

function sanitizeNode(value: unknown, index: number): BlueprintNodeModel {
  const node = (value ?? {}) as Partial<BlueprintNodeModel>;
  const id = stringValue(node.id, `node_${index + 1}`);
  const defaultX = (index % 4) * 360;
  const defaultY = Math.floor(index / 4) * 220;

  return {
    id,
    title: stringValue(node.title, id),
    subtitle: stringValue(node.subtitle),
    category: stringValue(node.category, 'Custom'),
    nodeType: ALLOWED_NODE_TYPES.has(node.nodeType as BlueprintNodeKind)
      ? (node.nodeType as BlueprintNodeKind)
      : 'custom',
    position: {
      x: numberValue(node.position?.x, defaultX),
      y: numberValue(node.position?.y, defaultY),
    },
    inputs: sanitizePins(node.inputs, `${id}_in`),
    outputs: sanitizePins(node.outputs, `${id}_out`),
    comment: stringValue(node.comment),
    keywords: uniqueStrings(node.keywords),
  };
}

function sanitizeVariables(value: unknown): BlueprintVariable[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const variable = (item ?? {}) as Partial<BlueprintVariable>;
    return {
      name: stringValue(variable.name, `Var_${index + 1}`),
      type: stringValue(variable.type, 'Any'),
      defaultValue: stringValue(variable.defaultValue),
      instanceEditable: booleanValue(variable.instanceEditable),
      exposeOnSpawn: booleanValue(variable.exposeOnSpawn),
      promoteFromNode: stringValue(variable.promoteFromNode),
      reason: stringValue(variable.reason),
    };
  });
}

function sanitizeSearchTips(value: unknown): SearchTip[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const tip = (item ?? {}) as Partial<SearchTip>;
    return {
      id: stringValue(tip.id, `tip_${index + 1}`),
      target: stringValue(tip.target),
      problem: stringValue(tip.problem),
      solution: stringValue(tip.solution),
    };
  });
}

function sanitizeMessages(value: unknown, nodeIds: Set<string>) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const message = (item ?? {}) as {
      id?: string;
      level?: AdviceLevel;
      title?: string;
      content?: string;
      relatedNodeIds?: string[];
    };

    const relatedNodeIds = Array.isArray(message.relatedNodeIds)
      ? message.relatedNodeIds.filter((nodeId) => typeof nodeId === 'string' && nodeIds.has(nodeId))
      : [];

    return {
      id: stringValue(message.id, `message_${index + 1}`),
      level: ALLOWED_LEVELS.has(message.level as AdviceLevel)
        ? (message.level as AdviceLevel)
        : 'note',
      title: stringValue(message.title, `提示 ${index + 1}`),
      content: stringValue(message.content),
      relatedNodeIds,
    };
  });
}

function sanitizeLinks(value: unknown, nodes: BlueprintNodeModel[]): BlueprintLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const pinMap = new Map(
    nodes.map((node) => [
      node.id,
      {
        inputs: new Set(node.inputs.map((pin) => pin.id)),
        outputs: new Set(node.outputs.map((pin) => pin.id)),
      },
    ]),
  );

  return value
    .map((item, index) => {
      const link = (item ?? {}) as Partial<BlueprintLink>;
      const fromNodeId = stringValue(link.fromNodeId);
      const toNodeId = stringValue(link.toNodeId);

      if (!pinMap.has(fromNodeId) || !pinMap.has(toNodeId)) {
        return null;
      }

      const sourcePins = pinMap.get(fromNodeId)?.outputs;
      const targetPins = pinMap.get(toNodeId)?.inputs;

      const fallbackFromPin = nodes.find((node) => node.id === fromNodeId)?.outputs[0]?.id ?? '';
      const fallbackToPin = nodes.find((node) => node.id === toNodeId)?.inputs[0]?.id ?? '';

      const fromPinId = sourcePins?.has(stringValue(link.fromPinId))
        ? stringValue(link.fromPinId)
        : fallbackFromPin;
      const toPinId = targetPins?.has(stringValue(link.toPinId))
        ? stringValue(link.toPinId)
        : fallbackToPin;

      if (!fromPinId || !toPinId) {
        return null;
      }

      return {
        id: stringValue(link.id, `link_${index + 1}`),
        fromNodeId,
        fromPinId,
        toNodeId,
        toPinId,
        kind: link.kind === 'exec' ? 'exec' : 'data',
        label: stringValue(link.label),
      };
    })
    .filter((item): item is BlueprintLink => Boolean(item));
}

export function normalizeBlueprintPlan(value: unknown): BlueprintPlan {
  const raw = (value ?? {}) as Partial<BlueprintPlan>;
  const nodes = Array.isArray(raw.nodes) ? raw.nodes.map(sanitizeNode) : [];
  const nodeIds = new Set(nodes.map((node) => node.id));

  return {
    meta: {
      title: stringValue(raw.meta?.title, '未命名蓝图'),
      summary: stringValue(raw.meta?.summary, 'AI 生成的蓝图方案。'),
      blueprintType: stringValue(raw.meta?.blueprintType, 'Actor'),
      ueVersion: stringValue(raw.meta?.ueVersion, 'UE 5.x'),
      targetUser: stringValue(raw.meta?.targetUser, 'Beginner'),
      sceneContext: stringValue(raw.meta?.sceneContext),
    },
    assistantReply: stringValue(raw.assistantReply, '已生成新的蓝图方案。'),
    nodes,
    links: sanitizeLinks(raw.links, nodes),
    variables: sanitizeVariables(raw.variables),
    messages: sanitizeMessages(raw.messages, nodeIds),
    searchTips: sanitizeSearchTips(raw.searchTips),
    checklist: uniqueStrings(raw.checklist, 16),
  };
}

export function getNodeAccent(nodeType: BlueprintNodeKind, category: string): string {
  const categoryText = category.toLowerCase();

  if (nodeType === 'event' || categoryText.includes('event') || categoryText.includes('input')) return 'event';
  if (nodeType === 'variable' || categoryText.includes('variable')) return 'variable';
  if (nodeType === 'macro' || categoryText.includes('timeline') || categoryText.includes('macro')) return 'macro';
  if (categoryText.includes('flow') || categoryText.includes('branch') || categoryText.includes('sequence')) return 'flow';
  if (categoryText.includes('math') || categoryText.includes('vector') || categoryText.includes('rotator')) return 'math';
  if (categoryText.includes('cast')) return 'cast';
  if (categoryText.includes('component') || categoryText.includes('actor') || categoryText.includes('mesh')) return 'component';
  if (nodeType === 'comment') return 'comment';
  return 'function';
}

export function getNodeColorByAccent(accent: string): string {
  switch (accent) {
    case 'event': return '#9f353a';
    case 'function': return '#1f5f9f';
    case 'macro': return '#8150b3';
    case 'variable': return '#2d8a41';
    case 'flow': return '#b8842b';
    case 'math': return '#2d918c';
    case 'cast': return '#5577c7';
    case 'component': return '#2c6f93';
    case 'comment': return '#6b6f78';
    default: return '#1f5f9f';
  }
}

export function getPinColor(pin: Pick<Pin, 'kind' | 'dataType'>): string {
  if (pin.kind === 'exec') return '#f4f4f4';

  const text = pin.dataType.toLowerCase();
  if (text.includes('bool')) return '#b73b3b';
  if (text.includes('int') || text.includes('byte')) return '#3aa55b';
  if (text.includes('float') || text.includes('double')) return '#9ac85f';
  if (text.includes('string')) return '#d84fb2';
  if (text.includes('text')) return '#e46fb0';
  if (text.includes('name')) return '#b969d8';
  if (text.includes('vector')) return '#f0c24f';
  if (text.includes('rotator')) return '#7c6fe6';
  if (text.includes('transform')) return '#df8a3d';
  if (text.includes('class')) return '#7a5bd6';
  if (text.includes('enum')) return '#7cc4aa';
  if (text.includes('struct')) return '#8dc5e8';
  if (text.includes('delegate') || text.includes('event')) return '#c04545';
  if (text.includes('actor') || text.includes('component') || text.includes('object') || text.includes('widget')) return '#54a6e8';
  return '#5fb7ff';
}

export function toFlowNodes(
  plan: BlueprintPlan,
  selectedNodeId: string | null,
): Node<BlueprintFlowNodeData>[] {
  return plan.nodes.map((node) => ({
    id: node.id,
    type: 'blueprintNode',
    position: node.position,
    data: {
      title: node.title,
      subtitle: node.subtitle,
      category: node.category,
      nodeType: node.nodeType,
      inputs: node.inputs,
      outputs: node.outputs,
      comment: node.comment,
      keywords: node.keywords,
      selected: selectedNodeId === node.id,
    },
    draggable: true,
    selectable: true,
  }));
}

export function autoLayoutNodes(
  nodes: Node<BlueprintFlowNodeData>[],
  edges: Edge[],
): Node<BlueprintFlowNodeData>[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 54, ranksep: 142 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    const isCompact = node.data.inputs.length <= 1 && node.data.outputs.length <= 1;
    const width = isCompact ? 168 : 250;
    const height = isCompact ? 50 : Math.max(node.data.inputs.length, node.data.outputs.length, 1) * 34 + 82;
    g.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const positioned = g.node(node.id);
    return {
      ...node,
      position: {
        x: positioned.x - positioned.width / 2,
        y: positioned.y - positioned.height / 2,
      },
    };
  });
}

export function toFlowEdges(plan: BlueprintPlan): Edge[] {
  return plan.links.map((link) => {
    const sourceNode = plan.nodes.find((node) => node.id === link.fromNodeId);
    const sourcePin = sourceNode?.outputs.find((pin) => pin.id === link.fromPinId);
    const fallbackPin = { kind: link.kind, dataType: link.kind === 'exec' ? 'Exec' : 'Any' } as Pick<Pin, 'kind' | 'dataType'>;
    const color = getPinColor(sourcePin ?? fallbackPin);
    const isExec = link.kind === 'exec';

    return {
      id: link.id,
      source: link.fromNodeId,
      target: link.toNodeId,
      sourceHandle: link.fromPinId,
      targetHandle: link.toPinId,
      label: link.label || undefined,
      type: 'default',
      animated: false,
      style: {
        stroke: color,
        strokeWidth: isExec ? 2.2 : 1.8,
      },
      labelStyle: {
        fill: '#d7e6f5',
        fontSize: 11,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color,
      },
    };
  });
}
