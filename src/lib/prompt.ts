import type { AppConfig, BlueprintLibrary, BlueprintPlan, ChatMessage } from '../types';
import { BLUEPRINT_PLAN_GUIDE, WORKSPACE_OPERATION_GUIDE } from '../schema';

interface BuildPromptArgs {
  config: AppConfig;
  userPrompt: string;
  currentPlan: BlueprintPlan;
  history: ChatMessage[];
  library: BlueprintLibrary;
}

const RECENT_HISTORY_COUNT = 8;
const OLDER_HISTORY_SUMMARY_COUNT = 18;

function truncateText(value: string, limit: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}…`;
}

function formatConversationLine(message: ChatMessage, index: number, limit: number): string {
  const prefix = message.role === 'user' ? '用户' : '助手';
  return `${index + 1}. ${prefix}：${truncateText(message.content, limit)}`;
}

function formatHistory(history: ChatMessage[]): string {
  if (history.length === 0) {
    return '无';
  }

  const older = history.slice(0, Math.max(0, history.length - RECENT_HISTORY_COUNT));
  const recent = history.slice(-RECENT_HISTORY_COUNT);
  const sections: string[] = [];

  if (older.length > 0) {
    const summaryLines = older
      .slice(-OLDER_HISTORY_SUMMARY_COUNT)
      .map((message, index) => formatConversationLine(message, index, message.role === 'user' ? 160 : 110));

    sections.push([
      `较早对话压缩摘要（共 ${older.length} 条，只用于延续上下文，不要覆盖用户当前需求）：`,
      ...summaryLines,
    ].join('\n'));
  }

  sections.push([
    `最近完整对话（${recent.length} 条，优先级高于压缩摘要）：`,
    ...recent.map((message, index) => formatConversationLine(message, index, message.role === 'user' ? 260 : 180)),
  ].join('\n'));

  return sections.join('\n\n');
}

function compactCurrentPlan(plan: BlueprintPlan): string {
  return JSON.stringify(
    {
      meta: plan.meta,
      nodes: plan.nodes,
      links: plan.links,
      variables: plan.variables,
      properties: plan.properties,
      messages: plan.messages,
      searchTips: plan.searchTips,
      checklist: plan.checklist,
    },
    null,
    2,
  );
}

function compactLibrary(library: BlueprintLibrary): string {
  return JSON.stringify(
    {
      activeProjectId: library.activeProjectId,
      projects: library.projects.slice(0, 80).map((project) => ({
        id: project.id,
        name: project.name,
        userName: project.userName,
        folderPath: project.folderPath,
        updatedAt: project.updatedAt,
        blueprintTitle: project.plan.meta.title,
        blueprintType: project.plan.meta.blueprintType,
        variableCount: project.plan.variables?.length ?? 0,
        propertyOverrideCount: project.plan.properties?.length ?? 0,
      })),
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
  library,
}: BuildPromptArgs): string {
  const activeProject = library.projects.find((project) => project.id === library.activeProjectId) ?? library.projects[0];
  const activeProjectLabel = activeProject
    ? `${activeProject.userName} / ${activeProject.folderPath} / ${activeProject.name}（id=${activeProject.id}）`
    : '无';
  const sections = [
    '请为 UE5 蓝图可视化工作台生成可执行的工作区 JSON 指令。',
    `用户当前需求：${userPrompt}`,
    `蓝图类型：${config.blueprintType}`,
    `UE 版本：${config.ueVersion}`,
    `场景上下文：${config.sceneContext || '未提供额外上下文'}`,
    `当前打开蓝图：${activeProjectLabel}`,
    `本地蓝图库摘要：\n${compactLibrary(library)}`,
    `本地长期会话摘要:\n${activeProject?.chatContextSummary?.trim() || '无'}`,
    `连续对话上下文：\n${formatHistory(history)}`,
    [
      '工作区操作规则：',
      '1. 根对象必须是 BlueprintWorkspaceResponse，responseType 固定为 blueprint_workspace_operation。',
      '2. 用户要求“新建、创建、另存为、放到某用户/文件夹、生成一套新的蓝图”时，返回 create_blueprint；前端会自动把蓝图加入 target.userName / target.folderPath。',
      '3. 用户要求“基于当前、修改当前、优化当前”且没有要求新建时，返回 replace_current_blueprint，target.projectId 写 active 或当前项目 id。',
      '4. 用户明确指定已有蓝图且能从本地蓝图库摘要匹配到项目 id 时，返回 update_blueprint；匹配不到但仍要生成时返回 create_blueprint。',
      '5. 每个 operation.plan 必须是完整 BlueprintPlan，不要只返回差异。',
      '6. 可以一次返回多个 operations；把需要打开查看的那一个 selectAfterApply 设为 true。',
      '',
      '蓝图内容约束：',
      '1. 严格左到右布局：事件/输入在左，判断/转换居中，组件调用/变量写入在右。',
      '2. category 与 nodeType 要贴近 UE5；Pin dataType 使用 Exec、Boolean、Float、Vector、Rotator、Actor、Component 等常见类型，便于前端按 UE5 颜色渲染。',
      '3. assistantReply 只写 2 到 4 句总结，不逐节点讲解。',
      '4. node.comment 默认留空，仅在节点难找、需要从组件/Pin 拖线、需要 Promote to Variable/Add Timeline/Add Custom Event 时填写短注释。',
      '5. messages / searchTips 只保留关键新手提醒，不要重复。',
      '6. checklist 写成可执行步骤；variables 只保留需要用户创建的蓝图变量。',
      '7. UE 蓝图自带属性或组件默认属性调整必须放入 properties，owner 写 Self 或组件名，例如 Actor Tick、Replicates、Auto Receive Input、Collision Presets、Mobility、Generate Overlap Events、Hidden in Game、Can Ever Affect Navigation。',
      '8. 不要把蓝图自带属性误写进 variables；variables 是左侧“用户变量”，properties 是右侧“蓝图属性”，owner 写 Self 或组件名。',
    ].join('\n'),
  ];

  if (config.editExistingGraph) {
    sections.push(`当前蓝图 JSON（如本轮是覆盖/更新，请在其基础上合理修改；如本轮是新建，只作为风格参考）：\n${compactCurrentPlan(currentPlan)}`);
  } else {
    sections.push('本轮默认按“新建蓝图方案”处理，不必继承当前示例图；如果用户没有指定目录，沿用当前用户与文件夹。');
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
    '必须满足的工作区结构：',
    WORKSPACE_OPERATION_GUIDE,
    '',
    '其中每个 operation.plan 必须满足：',
    BLUEPRINT_PLAN_GUIDE,
    '',
    '输出规则：',
    '1. 根对象 responseType 固定为 blueprint_workspace_operation，operations 至少一项。',
    '2. 要覆盖当前蓝图时用 replace_current_blueprint；要自动新建到用户/文件夹时用 create_blueprint；要更新已有蓝图时用 update_blueprint。',
    '3. target.userName / target.folderPath / target.blueprintName 是前端创建蓝图树的依据。',
    '4. 整体按左到右布局，节点坐标规整，避免交叉线。',
    '5. category 使用 UE5 常见分类；nodeType 与 category 保持一致。',
    '6. Pin dataType 使用 UE5 常见类型名，不要大量使用 Any。',
    '7. assistantReply 只写 2 到 4 句简短总结。',
    '8. 不要逐节点解释；node.comment 默认空字符串，只在关键节点写短注释。',
    '9. 如果节点不能直接右键搜到，要写清需要从组件或 Pin 拖线，或先 Add Timeline / Add Custom Event / Promote to Variable。',
    '10. variables 只列需要用户创建的蓝图变量，并注明 instanceEditable、exposeOnSpawn、promoteFromNode、reason。',
    '11. UE 蓝图自带属性、组件默认值和 Details 面板勾选项必须写到 properties，owner 写 Self 或组件名，例如 Tick、Replication、Collision、Input、Rendering、Component Defaults，不要混进 variables。',
    '12. 输出必须是合法 JSON，不得出现多余逗号、注释、Markdown 或非法空值。',
    '',
    `需求：${demand || '[在这里填写你的蓝图需求，例如：在 默认用户/投掷物 文件夹中新建 BP_GasGrenade 毒气弹蓝图]'}`,
  ].join('\n');
}
