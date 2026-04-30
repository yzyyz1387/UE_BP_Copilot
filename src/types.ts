export type ApiMode = 'chat_completions' | 'responses';
export type OutputFormatMode = 'auto' | 'json_schema' | 'json_object' | 'plain_json';
export type ConnectionMode = 'direct' | 'cloud_proxy' | 'local_proxy';
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

export type BlueprintPropertySource =
  | 'engine_default'
  | 'component_default'
  | 'user_override'
  | 'ai_override';

export interface BlueprintProperty {
  id: string;
  /** 属性归属对象，Self 表示蓝图自身；组件属性写组件名，例如 ProjectileMovement / SphereCollision。 */
  owner: string;
  category: string;
  name: string;
  type: string;
  value: string;
  defaultValue: string;
  source: BlueprintPropertySource;
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
  /** UE 蓝图 / 组件自带属性的默认值或覆盖值，区别于需要用户创建的 variables。 */
  properties: BlueprintProperty[];
  messages: AdviceMessage[];
  searchTips: SearchTip[];
  checklist: string[];
}

export interface BlueprintFlowNodeData {
  [key: string]: unknown;
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
  connectionMode: ConnectionMode;
  baseUrl: string;
  apiKey: string;
  model: string;
  apiMode: ApiMode;
  outputFormatMode: OutputFormatMode;
  requestTimeoutMs: number;
  localProxyUrl: string;
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

export type BlueprintOperationAction =
  | 'replace_current_blueprint'
  | 'create_blueprint'
  | 'update_blueprint';

export interface BlueprintOperationTarget {
  /** 已知项目 id。新建时留空；当前蓝图可写 active。 */
  projectId: string;
  userName: string;
  folderPath: string;
  blueprintName: string;
}

export interface BlueprintWorkspaceOperation {
  id: string;
  action: BlueprintOperationAction;
  target: BlueprintOperationTarget;
  selectAfterApply: boolean;
  plan: BlueprintPlan;
}

export interface BlueprintWorkspaceResponse {
  responseType: 'blueprint_workspace_operation';
  assistantReply: string;
  operations: BlueprintWorkspaceOperation[];
}

export interface GenerationResult {
  response: BlueprintWorkspaceResponse;
  rawText: string;
  endpointLabel: string;
}

export interface BlueprintProject {
  id: string;
  name: string;
  userName: string;
  folderPath: string;
  createdAt: string;
  updatedAt: string;
  plan: BlueprintPlan;
  chatMessages?: ChatMessage[];
  chatContextSummary?: string;
}

export interface BlueprintLibrary {
  version: 1;
  activeProjectId: string;
  projects: BlueprintProject[];
}
