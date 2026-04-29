import type { AppConfig, BlueprintPlan, ChatMessage } from '../types';
import { OUTPUT_SHAPE_GUIDE } from '../schema';

interface BuildPromptArgs {
  config: AppConfig;
  userPrompt: string;
  currentPlan: BlueprintPlan;
  history: ChatMessage[];
}

function truncateText(value: string, limit: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}…`;
}

function formatHistory(history: ChatMessage[]): string {
  const recent = history.slice(-4);
  if (recent.length === 0) {
    return '无';
  }

  return recent
    .map((message, index) => {
      const prefix = message.role === 'user' ? '用户' : '助手';
      const limit = message.role === 'user' ? 220 : 120;
      return `${index + 1}. ${prefix}：${truncateText(message.content, limit)}`;
    })
    .join('\n');
}

function compactCurrentPlan(plan: BlueprintPlan): string {
  return JSON.stringify(
    {
      meta: plan.meta,
      nodes: plan.nodes,
      links: plan.links,
      variables: plan.variables,
      messages: plan.messages,
      searchTips: plan.searchTips,
      checklist: plan.checklist,
    },
    null,
    2,
  );
}

export function buildGenerationPrompt({
  config,
  userPrompt,
  currentPlan,
  history,
}: BuildPromptArgs): string {
  const sections = [
    '请为 UE5 蓝图可视化工作台生成完整 JSON 数据。',
    `用户当前需求：${userPrompt}`,
    `蓝图类型：${config.blueprintType}`,
    `UE 版本：${config.ueVersion}`,
    `场景上下文：${config.sceneContext || '未提供额外上下文'}`,
    `最近对话摘要：\n${formatHistory(history)}`,
    [
      '额外约束：',
      '1. 严格左到右布局：事件/输入在左，判断/转换居中，组件调用/变量写入在右。',
      '2. category 与 nodeType 要贴近 UE5；Pin dataType 使用 Exec、Boolean、Float、Vector、Rotator、Actor、Component 等常见类型，便于前端按 UE5 颜色渲染。',
      '3. assistantReply 只写 2 到 4 句总结，不逐节点讲解。',
      '4. node.comment 默认留空，仅在节点难找、需要从组件/Pin 拖线、需要 Promote to Variable/Add Timeline/Add Custom Event 时填写短注释。',
      '5. messages / searchTips 只保留关键新手提醒，不要重复。',
      '6. checklist 写成可执行步骤；variables 只保留必要变量，不要堆候选。',
    ].join('\n'),
  ];

  if (config.editExistingGraph) {
    sections.push(`当前蓝图 JSON（请在其基础上合理修改）：\n${compactCurrentPlan(currentPlan)}`);
  } else {
    sections.push('本轮默认按“新建蓝图方案”处理，不必继承当前示例图。');
  }

  return sections.join('\n\n');
}

export function buildExternalPromptTemplate(config: AppConfig, demand: string): string {
  return [
    '你要为一个 UE5 蓝图可视化网页返回结构化 JSON。',
    '不要输出 Markdown，不要输出解释，只返回一个 JSON 对象。',
    '输出语言：简体中文。',
    `蓝图类型：${config.blueprintType}`,
    `UE 版本：${config.ueVersion}`,
    `场景上下文：${config.sceneContext || '未提供'}`,
    '',
    '必须满足的结构：',
    OUTPUT_SHAPE_GUIDE,
    '',
    '输出规则：',
    '1. 整体按左到右布局，节点坐标规整，避免交叉线。',
    '2. category 使用 UE5 常见分类；nodeType 与 category 保持一致。',
    '3. Pin dataType 使用 UE5 常见类型名，不要大量使用 Any。',
    '4. assistantReply 只写 2 到 4 句简短总结。',
    '5. 不要逐节点解释；node.comment 默认空字符串，只在关键节点写短注释。',
    '6. 如果节点不能直接右键搜到，要写清需要从组件或 Pin 拖线，或先 Add Timeline / Add Custom Event / Promote to Variable。',
    '7. variables 只列必要变量，并注明 instanceEditable、exposeOnSpawn、promoteFromNode、reason。',
    '8. 输出必须是合法 JSON，不得出现多余逗号、注释、Markdown 或非法空值。',
    '',
    `需求：${demand || '[在这里填写你的蓝图需求]'}`,
  ].join('\n');
}
