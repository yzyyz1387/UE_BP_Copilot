export type ApiMode = 'chat_completions' | 'responses';
export type PinKind = 'exec' | 'data';
export type AdviceLevel = 'note' | 'warning' | 'tip';
export type BlueprintNodeKind =
  | 'event'
  | 'function'
  | 'macro'
  | 'variable'
  | 'comment'
  | 'custom';

export interface Pin {
  id: string;
  label: string;
  kind: PinKind;
  dataType: string;
}

export interface BlueprintNodeModel {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  nodeType: BlueprintNodeKind;
  position: {
    x: number;
    y: number;
  };
  inputs: Pin[];
  outputs: Pin[];
  comment: string;
  keywords: string[];
}

export interface BlueprintLink {
  id: string;
  fromNodeId: string;
  fromPinId: string;
  toNodeId: string;
  toPinId: string;
  kind: PinKind;
  label: string;
}

export interface BlueprintVariable {
  name: string;
  type: string;
  defaultValue: string;
  instanceEditable: boolean;
  exposeOnSpawn: boolean;
  promoteFromNode: string;
  reason: string;
}

export interface AdviceMessage {
  id: string;
  level: AdviceLevel;
  title: string;
  content: string;
  relatedNodeIds: string[];
}

export interface SearchTip {
  id: string;
  target: string;
  problem: string;
  solution: string;
}

export interface BlueprintMeta {
  title: string;
  summary: string;
  blueprintType: string;
  ueVersion: string;
  targetUser: string;
  sceneContext: string;
}

export interface BlueprintPlan {
  meta: BlueprintMeta;
  assistantReply: string;
  nodes: BlueprintNodeModel[];
  links: BlueprintLink[];
  variables: BlueprintVariable[];
  messages: AdviceMessage[];
  searchTips: SearchTip[];
  checklist: string[];
}

export interface BlueprintFlowNodeData {
  title: string;
  subtitle: string;
  category: string;
  nodeType: BlueprintNodeKind;
  inputs: Pin[];
  outputs: Pin[];
  comment: string;
  keywords: string[];
  selected: boolean;
}

export interface AppConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  apiMode: ApiMode;
  blueprintType: string;
  ueVersion: string;
  sceneContext: string;
  editExistingGraph: boolean;
  persistApiKey: boolean;
  allowJsonFallback: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface GenerationResult {
  plan: BlueprintPlan;
  rawText: string;
  endpointLabel: string;
}
