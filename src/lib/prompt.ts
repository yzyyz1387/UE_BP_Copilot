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
    '请为前端可视化蓝图工具生成完整 JSON 数据。',
    `用户当前需求：${userPrompt}`,
    `Blueprint 类型：${config.blueprintType}`,
    `UE 版本：${config.ueVersion}`,
    `场景上下文：${config.sceneContext || '未提供额外上下文'}`,
    `最近对话摘要：\n${formatHistory(history)}`,
    [
      '额外约束：',
      '1. 整体从左到右布局。',
      '2. assistantReply 只写简短总结，不逐节点讲解。',
      '3. node.comment 默认留空，仅在关键节点填写短注释。',
      '4. messages / searchTips 只保留关键新手提醒，不要重复。',
      '5. checklist 要写成可执行步骤。',
      '6. variables 优先给出必要变量，不要堆过多候选。',
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
    `Blueprint 类型：${config.blueprintType}`,
    `UE 版本：${config.ueVersion}`,
    `场景上下文：${config.sceneContext || '未提供'}`,
    '',
    '必须满足的结构：',
    OUTPUT_SHAPE_GUIDE,
    '',
    '输出规则：',
    '1. 整体按左到右布局，节点坐标规整。',
    '2. assistantReply 只写 2 到 4 句简短总结。',
    '3. 不要逐节点解释。node.comment 默认空字符串，只有关键节点才写短注释。',
    '4. messages 与 searchTips 只保留少量高价值的新手提醒。',
    '5. 如果某节点不能直接右键搜到，要写清需要从组件或 Pin 拖线，或先 Add Timeline / Add Custom Event / Promote to Variable。',
    '6. variables 只列必要变量，并注明 instanceEditable、exposeOnSpawn、promoteFromNode、reason。',
    '7. 注意输出要严格按照json格式，比如不得出现空值四个双引号（""""）的情况',
    '',
    `需求：${demand || '[在这里填写你的蓝图需求]'}`,
  ].join('\n');
}
