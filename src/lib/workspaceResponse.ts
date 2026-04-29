import type {
  BlueprintOperationAction,
  BlueprintOperationTarget,
  BlueprintPlan,
  BlueprintWorkspaceOperation,
  BlueprintWorkspaceResponse,
} from '../types';
import { normalizeBlueprintPlan } from './blueprintTransform';

const ACTIONS = new Set<BlueprintOperationAction>([
  'replace_current_blueprint',
  'create_blueprint',
  'update_blueprint',
]);

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function looksLikeBlueprintPlan(value: unknown): value is BlueprintPlan {
  const candidate = value as Partial<BlueprintPlan> | null;
  return Boolean(
    candidate &&
      typeof candidate === 'object' &&
      candidate.meta &&
      typeof candidate.meta === 'object' &&
      Array.isArray(candidate.nodes) &&
      Array.isArray(candidate.links),
  );
}

export function looksLikeWorkspaceResponse(value: unknown): value is BlueprintWorkspaceResponse {
  const candidate = value as Partial<BlueprintWorkspaceResponse> | null;
  return Boolean(
    candidate &&
      typeof candidate === 'object' &&
      candidate.responseType === 'blueprint_workspace_operation' &&
      Array.isArray(candidate.operations),
  );
}

function normalizeTarget(value: unknown, plan: BlueprintPlan): BlueprintOperationTarget {
  const target = (value ?? {}) as Partial<BlueprintOperationTarget>;
  return {
    projectId: stringValue(target.projectId),
    userName: stringValue(target.userName, plan.meta.targetUser || '默认用户'),
    folderPath: stringValue(target.folderPath, plan.meta.blueprintType || 'AI 生成'),
    blueprintName: stringValue(target.blueprintName, plan.meta.title || '未命名蓝图'),
  };
}

function normalizeOperation(value: unknown, index: number): BlueprintWorkspaceOperation | null {
  const operation = (value ?? {}) as Partial<BlueprintWorkspaceOperation>;
  if (!looksLikeBlueprintPlan(operation.plan)) {
    return null;
  }

  const plan = normalizeBlueprintPlan(operation.plan);
  const action = ACTIONS.has(operation.action as BlueprintOperationAction)
    ? (operation.action as BlueprintOperationAction)
    : 'replace_current_blueprint';

  return {
    id: stringValue(operation.id, `op_${index + 1}`),
    action,
    target: normalizeTarget(operation.target, plan),
    selectAfterApply: booleanValue(operation.selectAfterApply, index === 0),
    plan,
  };
}

export function wrapPlanAsWorkspaceResponse(planValue: unknown, assistantReply?: string): BlueprintWorkspaceResponse {
  if (!looksLikeBlueprintPlan(planValue)) {
    throw new Error('JSON 不是可识别的蓝图方案或工作区操作。');
  }

  const plan = normalizeBlueprintPlan(planValue);
  return {
    responseType: 'blueprint_workspace_operation',
    assistantReply: assistantReply || plan.assistantReply || '已生成蓝图。',
    operations: [
      {
        id: 'op_replace_current',
        action: 'replace_current_blueprint',
        target: {
          projectId: 'active',
          userName: '',
          folderPath: '',
          blueprintName: plan.meta.title || '未命名蓝图',
        },
        selectAfterApply: true,
        plan,
      },
    ],
  };
}

export function normalizeBlueprintWorkspaceResponse(value: unknown): BlueprintWorkspaceResponse {
  if (looksLikeWorkspaceResponse(value)) {
    const operations = value.operations
      .map((operation, index) => normalizeOperation(operation, index))
      .filter((operation): operation is BlueprintWorkspaceOperation => Boolean(operation));

    if (operations.length === 0) {
      throw new Error('工作区操作中没有可用的蓝图 plan。');
    }

    return {
      responseType: 'blueprint_workspace_operation',
      assistantReply: stringValue(value.assistantReply, operations[0].plan.assistantReply || '已执行蓝图操作。'),
      operations,
    };
  }

  return wrapPlanAsWorkspaceResponse(value);
}
