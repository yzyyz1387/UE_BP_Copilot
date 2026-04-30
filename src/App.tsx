import { useEffect, useMemo, useState } from 'react';
import { BlueprintCanvas } from './components/BlueprintCanvas';
import { ChatPanel } from './components/ChatPanel';
import { HeaderBar } from './components/HeaderBar';
import { ImportPanel } from './components/ImportPanel';
import { InspectorTabs, type InspectorTab } from './components/InspectorTabs';
import { ProjectSidebar } from './components/ProjectSidebar';
import { SettingsPanel } from './components/SettingsPanel';
import { Toast, useToast } from './components/Toast';
import { DEMO_BLUEPRINT } from './data/demoBlueprint';
import {
  createBlueprintProject,
  loadStoredConfig,
  loadStoredLibrary,
  storeConfig,
  storeLibrary,
  storePlan,
} from './lib/localStorage';
import { normalizeBlueprintPlan } from './lib/blueprintTransform';
import { generateBlueprintPlan, testModelConnection } from './lib/openaiClient';
import { buildExternalPromptTemplate } from './lib/prompt';
import { normalizeBlueprintWorkspaceResponse } from './lib/workspaceResponse';
import type {
  AppConfig,
  BlueprintLibrary,
  BlueprintOperationTarget,
  BlueprintPlan,
  BlueprintProject,
  BlueprintVariable,
  BlueprintWorkspaceResponse,
  ChatMessage,
} from './types';

const DEFAULT_CONFIG: AppConfig = {
  connectionMode: 'direct',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o',
  apiMode: 'chat_completions',
  outputFormatMode: 'auto',
  requestTimeoutMs: 60000,
  localProxyUrl: 'http://127.0.0.1:8787',
  blueprintType: 'Actor',
  ueVersion: 'UE 5.3+',
  sceneContext: '',
  editExistingGraph: true,
  persistApiKey: false,
  allowJsonFallback: true,
};

const PRESET_PROMPTS = [
  '做一个按下 E 打开门的 Actor 蓝图',
  '在 默认用户/投掷物 文件夹中新建 BP_GasGrenade 毒气弹蓝图',
  '创建两个蓝图：BP_Grenade_Base 和 BP_GasGrenade，放到 默认用户/投掷物 文件夹',
  '基于当前图，改成按一次打开，再按一次关闭',
];

type RightPanelTab = 'chat' | 'properties' | 'ai';

const RECENT_CONTEXT_MESSAGE_COUNT = 8;
const MAX_STORED_CHAT_MESSAGES = 160;

const RIGHT_PANEL_TABS: Array<{ id: RightPanelTab; label: string; hint: string }> = [
  { id: 'chat', label: '对话', hint: '连续追问与生成' },
  { id: 'properties', label: '蓝图属性', hint: 'Details / 变量 / 清单' },
  { id: 'ai', label: 'AI 配置', hint: '接口、导入和提示词' },
];

function timeString(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: crypto.randomUUID(), role, content, createdAt: timeString() };
}

function summarizeChatForStorage(messages: ChatMessage[]): string {
  const older = messages.slice(0, Math.max(0, messages.length - RECENT_CONTEXT_MESSAGE_COUNT));
  if (older.length === 0) return '';

  return older
    .slice(-24)
    .map((message, index) => {
      const role = message.role === 'user' ? '用户' : '助手';
      const text = message.content.replace(/\s+/g, ' ').trim();
      return `${index + 1}. ${role}：${text.length > 120 ? `${text.slice(0, 120)}…` : text}`;
    })
    .join('\n');
}

function compactStoredMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_STORED_CHAT_MESSAGES) return messages;
  const kept = messages.slice(-MAX_STORED_CHAT_MESSAGES);
  return [
    createMessage('assistant', `较早的 ${messages.length - kept.length} 条对话已在本地存储中压缩；继续生成时仍会把最近对话和摘要传给 AI。`),
    ...kept,
  ];
}

function attachChatToProject(project: BlueprintProject, messages: ChatMessage[]): BlueprintProject {
  const storedMessages = compactStoredMessages(messages);
  return {
    ...project,
    chatMessages: storedMessages,
    chatContextSummary: summarizeChatForStorage(messages),
  };
}

function createDefaultChatMessages(project: BlueprintProject | undefined, plan: BlueprintPlan): ChatMessage[] {
  const location = project ? `${project.userName} / ${project.folderPath}` : '默认用户 / 示例蓝图';
  return [
    createMessage('assistant', `已打开“${plan.meta.title || project?.name || '未命名蓝图'}”。这个蓝图归档在 ${location}。你可以直接追问或要求 AI 基于当前图继续修改。`),
    createMessage('assistant', plan.assistantReply),
  ];
}

function getProjectChatMessages(project: BlueprintProject | undefined, plan: BlueprintPlan): ChatMessage[] {
  const storedMessages = project?.chatMessages;
  if (Array.isArray(storedMessages) && storedMessages.length > 0) {
    return storedMessages;
  }
  return createDefaultChatMessages(project, plan);
}

function downloadJsonFile(plan: BlueprintPlan): void {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = 'ue-blueprint-plan.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function extractJsonString(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('导入内容为空。');
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  throw new Error('没有找到可解析的 JSON 对象。');
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function findActivePlan(library: BlueprintLibrary): BlueprintPlan {
  return library.projects.find((project) => project.id === library.activeProjectId)?.plan ?? library.projects[0]?.plan ?? DEMO_BLUEPRINT;
}

function cleanText(value: string | undefined, fallback: string): string {
  const text = value?.trim();
  return text || fallback;
}

function getProjectPath(project: Pick<BlueprintProject, 'userName' | 'folderPath' | 'name'>): string {
  return `${project.userName} / ${project.folderPath} / ${project.name}`;
}

function findProjectByTarget(
  projects: BlueprintProject[],
  activeProjectId: string,
  target: BlueprintOperationTarget,
): BlueprintProject | undefined {
  const targetProjectId = target.projectId.trim();
  if (targetProjectId === 'active') {
    return projects.find((project) => project.id === activeProjectId);
  }
  if (targetProjectId) {
    const matchedById = projects.find((project) => project.id === targetProjectId);
    if (matchedById) return matchedById;
  }

  const targetUserName = target.userName.trim();
  const targetFolderPath = target.folderPath.trim();
  const targetBlueprintName = target.blueprintName.trim();
  if (!targetUserName || !targetFolderPath || !targetBlueprintName) {
    return undefined;
  }

  return projects.find(
    (project) =>
      project.userName === targetUserName &&
      project.folderPath === targetFolderPath &&
      project.name === targetBlueprintName,
  );
}

function withPlanTitle(plan: BlueprintPlan, title: string): BlueprintPlan {
  return normalizeBlueprintPlan({
    ...plan,
    meta: {
      ...plan.meta,
      title: plan.meta.title?.trim() || title,
    },
  });
}

export default function App() {
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();
  const [initialLibrary] = useState<BlueprintLibrary>(() => loadStoredLibrary(DEMO_BLUEPRINT));
  const initialProject = initialLibrary.projects.find((project) => project.id === initialLibrary.activeProjectId) ?? initialLibrary.projects[0];
  const initialPlan = normalizeBlueprintPlan(findActivePlan(initialLibrary));
  const [config, setConfig] = useState<AppConfig>(() => loadStoredConfig(DEFAULT_CONFIG));
  const [library, setLibrary] = useState<BlueprintLibrary>(initialLibrary);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [plan, setPlan] = useState<BlueprintPlan>(initialPlan);
  const [rawJson, setRawJson] = useState<string>(() => JSON.stringify(initialPlan, null, 2));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialPlan.nodes[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<InspectorTab>('notes');
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('chat');
  const [prompt, setPrompt] = useState<string>('做一个按下 E 打开门的 Actor 蓝图');
  const [importText, setImportText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => getProjectChatMessages(initialProject, initialPlan));
  const [busy, setBusy] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [statusText, setStatusText] = useState('本地优先 · 支持直连 / 云端中转 / 本地代理');
  const [endpointLabel, setEndpointLabel] = useState('');

  const activeProject = useMemo(
    () => library.projects.find((project) => project.id === library.activeProjectId) ?? library.projects[0],
    [library],
  );

  useEffect(() => { storeConfig(config); }, [config]);
  useEffect(() => { storeLibrary(library); }, [library]);
  useEffect(() => { storePlan(plan); }, [plan]);

  const selectedNode = useMemo(
    () => plan.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [plan, selectedNodeId],
  );

  const externalPrompt = useMemo(
    () => buildExternalPromptTemplate(config, prompt.trim()),
    [config, prompt],
  );

  const compactedMessageCount = Math.max(0, messages.length - RECENT_CONTEXT_MESSAGE_COUNT);

  const handleConfigChange = (patch: Partial<AppConfig>) =>
    setConfig((c) => ({ ...c, ...patch }));

  const persistChatMessages = (projectId: string, nextMessages: ChatMessage[]) => {
    setLibrary((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId ? attachChatToProject(project, nextMessages) : project,
      ),
    }));
  };

  const replaceChatMessages = (nextMessages: ChatMessage[], projectId = library.activeProjectId) => {
    setMessages(nextMessages);
    persistChatMessages(projectId, nextMessages);
  };

  const appendChatMessages = (items: ChatMessage[], projectId?: string) => {
    setMessages((current) => {
      const nextMessages = [...current, ...items];
      setLibrary((currentLibrary) => {
        const targetProjectId = projectId ?? currentLibrary.activeProjectId;
        return {
          ...currentLibrary,
          projects: currentLibrary.projects.map((project) =>
            project.id === targetProjectId ? attachChatToProject(project, nextMessages) : project,
          ),
        };
      });
      return nextMessages;
    });
  };

  const savePlanToActiveProject = (nextPlan: BlueprintPlan) => {
    setLibrary((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === current.activeProjectId
          ? {
              ...project,
              name: nextPlan.meta.title?.trim() || project.name,
              updatedAt: new Date().toISOString(),
              plan: nextPlan,
            }
          : project,
      ),
    }));
  };

  const setCurrentPlan = (nextPlan: BlueprintPlan, status: string) => {
    setPlan(nextPlan);
    setRawJson(JSON.stringify(nextPlan, null, 2));
    setSelectedNodeId(nextPlan.nodes[0]?.id ?? null);
    setActiveTab('notes');
    setStatusText(status);
  };

  const applyPlan = (nextPlan: BlueprintPlan, sourceLabel: string, assistantText?: string) => {
    savePlanToActiveProject(nextPlan);
    setEndpointLabel(sourceLabel);
    setCurrentPlan(nextPlan, `已更新：${nextPlan.meta.title}`);
    if (assistantText) appendChatMessages([createMessage('assistant', assistantText)]);
  };

  const applyWorkspaceResponse = (response: BlueprintWorkspaceResponse, sourceLabel: string, baseHistory: ChatMessage[] = messages) => {
    if (response.operations.length === 0) {
      showToast('AI 返回中没有可执行的蓝图操作。', 'error');
      return;
    }

    let nextProjects: BlueprintProject[] = [...library.projects];
    let activeProjectId = library.activeProjectId;
    let selectedProjectId = library.activeProjectId;
    let lastAppliedProjectId = library.activeProjectId;
    let hasExplicitSelection = false;
    const descriptions: string[] = [];
    const now = new Date().toISOString();

    const findCurrentActive = () =>
      nextProjects.find((project) => project.id === activeProjectId) ?? nextProjects[0];

    const markSelection = (projectId: string, explicit: boolean) => {
      lastAppliedProjectId = projectId;
      if (explicit || !hasExplicitSelection) {
        selectedProjectId = projectId;
      }
      if (explicit) {
        hasExplicitSelection = true;
      }
    };

    response.operations.forEach((operation, index) => {
      const currentActive = findCurrentActive();
      const normalizedPlan = normalizeBlueprintPlan(operation.plan);
      const fallbackName = normalizedPlan.meta.title || currentActive?.name || `AI 蓝图 ${index + 1}`;
      const targetName = cleanText(operation.target.blueprintName, fallbackName);
      const targetUserName = cleanText(operation.target.userName, currentActive?.userName || '默认用户');
      const targetFolderPath = cleanText(operation.target.folderPath, currentActive?.folderPath || 'AI 生成');
      const targetPlan = withPlanTitle(normalizedPlan, targetName);

      if (operation.action === 'create_blueprint') {
        const project = createBlueprintProject(targetPlan, {
          name: targetName,
          userName: targetUserName,
          folderPath: targetFolderPath,
        });
        nextProjects = [...nextProjects, project];
        descriptions.push(`新建：${getProjectPath(project)}`);
        markSelection(project.id, operation.selectAfterApply);
        return;
      }

      const matchedProject = operation.action === 'replace_current_blueprint'
        ? currentActive
        : findProjectByTarget(nextProjects, activeProjectId, operation.target);

      if (!matchedProject) {
        const project = createBlueprintProject(targetPlan, {
          name: targetName,
          userName: targetUserName,
          folderPath: targetFolderPath,
        });
        nextProjects = [...nextProjects, project];
        descriptions.push(`新建：${getProjectPath(project)}（未匹配到可更新蓝图）`);
        markSelection(project.id, operation.selectAfterApply);
        return;
      }

      const shouldPreserveActiveLocation =
        operation.action === 'replace_current_blueprint' && operation.target.projectId.trim() === 'active';
      const updatedProject: BlueprintProject = {
        ...matchedProject,
        name: targetName || matchedProject.name,
        userName: shouldPreserveActiveLocation
          ? matchedProject.userName
          : targetUserName || matchedProject.userName,
        folderPath: shouldPreserveActiveLocation
          ? matchedProject.folderPath
          : targetFolderPath || matchedProject.folderPath,
        updatedAt: now,
        plan: targetPlan,
      };

      nextProjects = nextProjects.map((project) =>
        project.id === matchedProject.id ? updatedProject : project,
      );
      activeProjectId = operation.action === 'replace_current_blueprint' ? updatedProject.id : activeProjectId;
      descriptions.push(`${operation.action === 'update_blueprint' ? '更新' : '覆盖'}：${getProjectPath(updatedProject)}`);
      markSelection(updatedProject.id, operation.selectAfterApply || operation.action === 'replace_current_blueprint');
    });

    if (!hasExplicitSelection) {
      selectedProjectId = lastAppliedProjectId;
    }

    const selectedProject = nextProjects.find((project) => project.id === selectedProjectId) ?? nextProjects[0];
    if (!selectedProject) {
      showToast('AI 操作执行失败：没有可打开的蓝图。', 'error');
      return;
    }

    const selectedPlan = normalizeBlueprintPlan(selectedProject.plan);
    const status = descriptions.length > 1
      ? `已执行 ${descriptions.length} 个 AI 蓝图操作`
      : descriptions[0] || `已打开：${selectedProject.name}`;
    const assistantText = response.assistantReply || selectedPlan.assistantReply;
    const nextMessages = assistantText
      ? [...baseHistory, createMessage('assistant', assistantText)]
      : baseHistory;
    const projectsWithChat = nextProjects.map((project) =>
      project.id === selectedProject.id ? attachChatToProject(project, nextMessages) : project,
    );
    const nextLibrary: BlueprintLibrary = {
      version: 1,
      activeProjectId: selectedProject.id,
      projects: projectsWithChat,
    };

    setLibrary(nextLibrary);
    setMessages(nextMessages);
    setEndpointLabel(sourceLabel);
    setCurrentPlan(selectedPlan, status);
    setRightPanelTab('chat');
    showToast(status, 'success');
  };

  const handleSelectProject = (projectId: string) => {
    const project = library.projects.find((item) => item.id === projectId);
    if (!project) return;
    const normalizedPlan = normalizeBlueprintPlan(project.plan);
    const projectMessages = getProjectChatMessages(project, normalizedPlan);
    setLibrary((current) => ({
      ...current,
      activeProjectId: projectId,
      projects: current.projects.map((item) =>
        item.id === projectId ? attachChatToProject(item, projectMessages) : item,
      ),
    }));
    setEndpointLabel('本地存储');
    setCurrentPlan(normalizedPlan, `已打开：${project.name}`);
    setMessages(projectMessages);
    setRightPanelTab('chat');
  };

  const handleCreateProject = () => {
    const userName = window.prompt('用户名称', activeProject?.userName || '默认用户')?.trim();
    if (!userName) return;
    const folderPath = window.prompt('文件夹路径', activeProject?.folderPath || '未分类')?.trim();
    if (!folderPath) return;
    const name = window.prompt('蓝图名称', '新建蓝图')?.trim();
    if (!name) return;

    const nextPlan = normalizeBlueprintPlan({
      ...DEMO_BLUEPRINT,
      meta: {
        ...DEMO_BLUEPRINT.meta,
        title: name,
        summary: '新建本地蓝图，可在右侧输入需求后生成或导入 JSON。',
      },
      assistantReply: '已创建新的本地蓝图。你可以在输入框描述需求后生成，也可以导入已有 JSON。',
    });
    const project = createBlueprintProject(nextPlan, { name, userName, folderPath });
    const projectMessages = createDefaultChatMessages(project, nextPlan);
    const projectWithChat = attachChatToProject(project, projectMessages);

    setLibrary((current) => ({
      ...current,
      activeProjectId: projectWithChat.id,
      projects: [...current.projects, projectWithChat],
    }));
    setMessages(projectMessages);
    setEndpointLabel('本地新建');
    setCurrentPlan(nextPlan, `已新建：${name}`);
    setRightPanelTab('chat');
  };

  const handleDuplicateProject = () => {
    const name = window.prompt('复制后的蓝图名称', `${plan.meta.title || activeProject?.name || '蓝图'} 副本`)?.trim();
    if (!name || !activeProject) return;
    const nextPlan = normalizeBlueprintPlan({
      ...plan,
      meta: { ...plan.meta, title: name },
    });
    const project = createBlueprintProject(nextPlan, {
      name,
      userName: activeProject.userName,
      folderPath: activeProject.folderPath,
    });
    const projectMessages = [
      createMessage('assistant', `已把当前蓝图复制为“${name}”。你可以在这个副本上继续追问或生成。`),
      createMessage('assistant', nextPlan.assistantReply),
    ];
    const projectWithChat = attachChatToProject(project, projectMessages);

    setLibrary((current) => ({
      ...current,
      activeProjectId: projectWithChat.id,
      projects: [...current.projects, projectWithChat],
    }));
    setMessages(projectMessages);
    setEndpointLabel('本地复制');
    setCurrentPlan(nextPlan, `已复制：${name}`);
    setRightPanelTab('chat');
  };

  const updateActivePlan = (nextPlan: BlueprintPlan, status: string, assistantText?: string) => {
    const normalizedPlan = normalizeBlueprintPlan(nextPlan);
    savePlanToActiveProject(normalizedPlan);
    setEndpointLabel('本地变量');
    setCurrentPlan(normalizedPlan, status);
    if (assistantText) appendChatMessages([createMessage('assistant', assistantText)]);
  };

  const hasVariableName = (variables: BlueprintVariable[], name: string, exceptName = '') => {
    const normalizedName = name.trim().toLowerCase();
    const normalizedExcept = exceptName.trim().toLowerCase();
    return variables.some((variable) => {
      const currentName = variable.name.trim().toLowerCase();
      return currentName === normalizedName && currentName !== normalizedExcept;
    });
  };

  const handleCreateVariable = (variable: BlueprintVariable) => {
    const nextName = variable.name.trim();
    if (!nextName) {
      showToast('变量名称不能为空。', 'error');
      return;
    }
    if (hasVariableName(plan.variables, nextName)) {
      showToast(`变量“${nextName}”已存在。`, 'error');
      return;
    }

    const nextPlan = {
      ...plan,
      variables: [...plan.variables, { ...variable, name: nextName }],
    };
    updateActivePlan(nextPlan, `已添加变量：${nextName}`);
    showToast(`已添加变量：${nextName}`, 'success');
  };

  const handleUpdateVariable = (originalName: string, variable: BlueprintVariable) => {
    const nextName = variable.name.trim();
    if (!nextName) {
      showToast('变量名称不能为空。', 'error');
      return;
    }
    if (hasVariableName(plan.variables, nextName, originalName)) {
      showToast(`变量“${nextName}”已存在。`, 'error');
      return;
    }

    const nextVariables = plan.variables.map((item) =>
      item.name === originalName ? { ...variable, name: nextName } : item,
    );
    const nextPlan = { ...plan, variables: nextVariables };
    updateActivePlan(nextPlan, `已更新变量：${nextName}`);
    showToast(`已更新变量：${nextName}`, 'success');
  };

  const handleDeleteVariable = (name: string) => {
    const nextVariables = plan.variables.filter((variable) => variable.name !== name);
    if (nextVariables.length === plan.variables.length) {
      showToast(`没有找到变量“${name}”。`, 'error');
      return;
    }

    const nextPlan = { ...plan, variables: nextVariables };
    updateActivePlan(nextPlan, `已删除变量：${name}`);
    showToast(`已删除变量：${name}`, 'success');
  };

  const handleUpdatePropertyValue = (propertyId: string, value: string) => {
    const property = plan.properties.find((item) => item.id === propertyId);
    if (!property) return;

    const normalizedPlan = normalizeBlueprintPlan({
      ...plan,
      properties: plan.properties.map((item) =>
        item.id === propertyId ? { ...item, value, source: 'user_override' } : item,
      ),
    });

    setLibrary((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === current.activeProjectId
          ? {
              ...project,
              name: normalizedPlan.meta.title?.trim() || project.name,
              updatedAt: new Date().toISOString(),
              plan: normalizedPlan,
            }
          : project,
      ),
    }));
    setPlan(normalizedPlan);
    setRawJson(JSON.stringify(normalizedPlan, null, 2));
    setEndpointLabel('本地属性');
    setStatusText(`已更新属性：${property.owner}.${property.name}`);
  };

  const handleDeleteProject = () => {
    if (!activeProject) return;
    if (library.projects.length <= 1) {
      showToast('至少需要保留一个本地蓝图。', 'error');
      return;
    }
    if (!window.confirm(`确定删除“${activeProject.name}”？此操作只删除浏览器本地存储中的这份蓝图。`)) return;

    const remaining = library.projects.filter((project) => project.id !== activeProject.id);
    const nextActive = remaining[0];
    const nextPlan = normalizeBlueprintPlan(nextActive.plan);
    const nextMessages = [
      ...getProjectChatMessages(nextActive, nextPlan),
      createMessage('assistant', `已删除“${activeProject.name}”，并打开“${nextActive.name}”。`),
    ];
    const projectsWithChat = remaining.map((project) =>
      project.id === nextActive.id ? attachChatToProject(project, nextMessages) : project,
    );

    setLibrary({ version: 1, activeProjectId: nextActive.id, projects: projectsWithChat });
    setMessages(nextMessages);
    setEndpointLabel('本地存储');
    setCurrentPlan(nextPlan, `已删除，当前打开：${nextActive.name}`);
    setRightPanelTab('chat');
  };

  const handleLoadDemo = () => {
    const demoPlan = normalizeBlueprintPlan(DEMO_BLUEPRINT);
    const demoMessages = [
      createMessage('assistant', '已重置到本地示例图。你可以直接覆盖需求，也可以勾选“基于当前蓝图继续修改”让模型沿着当前图继续迭代。'),
      createMessage('assistant', DEMO_BLUEPRINT.assistantReply),
    ];
    setLibrary((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === current.activeProjectId
          ? attachChatToProject({
              ...project,
              name: demoPlan.meta.title?.trim() || project.name,
              updatedAt: new Date().toISOString(),
              plan: demoPlan,
            }, demoMessages)
          : project,
      ),
    }));
    setMessages(demoMessages);
    setEndpointLabel('示例');
    setCurrentPlan(demoPlan, '已载入本地示例图');
    setRightPanelTab('chat');
  };

  const handleExport = () => { downloadJsonFile(plan); setStatusText('已导出当前蓝图 JSON'); };

  const handleCopy = async () => {
    try {
      await copyToClipboard(JSON.stringify(plan, null, 2));
      showToast('已复制当前蓝图 JSON', 'success');
      setStatusText('已复制当前蓝图 JSON');
    } catch {
      showToast('复制失败，请改用导出 JSON', 'error');
    }
  };

  const handleCopyExternalPrompt = async () => {
    try {
      await copyToClipboard(externalPrompt);
      showToast('已复制外部 AI 提示词', 'success');
    } catch {
      showToast('提示词复制失败', 'error');
    }
  };

  const handleApplyImport = () => {
    try {
      const parsed = JSON.parse(extractJsonString(importText));
      const workspaceResponse = normalizeBlueprintWorkspaceResponse(parsed);
      applyWorkspaceResponse(workspaceResponse, '导入工作区 JSON', messages);
    } catch (reason) {
      showToast(`导入 JSON 失败：${reason instanceof Error ? reason.message : '未知错误'}`, 'error');
      setStatusText('导入失败');
    }
  };

  const handleClearChat = () => {
    const nextMessages = [createMessage('assistant', '会话已清空。你可以重新描述需求，也可以保留当前蓝图继续修改。')];
    replaceChatMessages(nextMessages);
    setStatusText('会话已清空');
  };

  const handleTestConnection = async () => {
    if (!config.apiKey.trim()) {
      showToast('请先在右侧接口设置中填写密钥。', 'error');
      return;
    }

    setTestingConnection(true);
    setStatusText('正在测试模型连接...');

    try {
      const result = await testModelConnection(config);
      showToast(result.message, 'success');
      setEndpointLabel(result.endpointLabel);
      setStatusText('连接测试成功');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '连接测试失败';
      showToast(message, 'error');
      setStatusText('连接测试失败');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSend = async () => {
    const userPrompt = prompt.trim();
    if (!userPrompt) { showToast('请先输入你想生成的蓝图需求。', 'error'); return; }
    if (!config.apiKey.trim()) { showToast('请先在右侧接口设置中填写密钥。', 'error'); return; }

    const userMessage = createMessage('user', userPrompt);
    const history = [...messages, userMessage];
    replaceChatMessages(history);
    setBusy(true);
    setStatusText('正在调用模型生成蓝图工作区操作...');

    try {
      const result = await generateBlueprintPlan({ config, userPrompt, currentPlan: plan, history, library });
      applyWorkspaceResponse(result.response, result.endpointLabel, history);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '生成失败';
      showToast(message, 'error');
      setStatusText('生成失败');
      appendChatMessages([createMessage('assistant', `这次生成失败了：${message}`)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <ProjectSidebar
        library={library}
        plan={plan}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onDuplicateProject={handleDuplicateProject}
        onDeleteProject={handleDeleteProject}
        onCreateVariable={handleCreateVariable}
        onUpdateVariable={handleUpdateVariable}
        onDeleteVariable={handleDeleteVariable}
      />

      <main className="workspace">
        <section className="left-pane">
          <HeaderBar
            statusText={statusText}
            endpointLabel={endpointLabel}
            selectedNode={selectedNode}
            onLoadDemo={handleLoadDemo}
            onExportJson={handleExport}
            onCopyJson={handleCopy}
          />
          <BlueprintCanvas
            plan={plan}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            storageScope={activeProject?.id}
          />
        </section>

        <aside className="right-pane">
          <div className="right-pane__tabbar" role="tablist" aria-label="右侧面板">
            {RIGHT_PANEL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`right-pane__tab ${rightPanelTab === tab.id ? 'is-active' : ''}`}
                onClick={() => setRightPanelTab(tab.id)}
                role="tab"
                aria-selected={rightPanelTab === tab.id}
              >
                <strong>{tab.label}</strong>
                <span>{tab.hint}</span>
              </button>
            ))}
          </div>

          {rightPanelTab === 'chat' ? (
            <div className="right-pane__page right-pane__page--chat">
              <ChatPanel
                messages={messages}
                prompt={prompt}
                presets={PRESET_PROMPTS}
                busy={busy}
                editExistingGraph={config.editExistingGraph}
                compactedMessageCount={compactedMessageCount}
                onPromptChange={setPrompt}
                onUsePreset={setPrompt}
                onEditExistingGraphChange={(v) => handleConfigChange({ editExistingGraph: v })}
                onSend={handleSend}
                onClear={handleClearChat}
              />
            </div>
          ) : null}

          {rightPanelTab === 'properties' ? (
            <div className="right-pane__page right-pane__scroll">
              <InspectorTabs
                plan={plan}
                selectedNode={selectedNode}
                activeTab={activeTab}
                rawJson={rawJson}
                onChangeTab={setActiveTab}
                onFocusNode={(nodeId) => { setSelectedNodeId(nodeId); setActiveTab('notes'); }}
                onUpdatePropertyValue={handleUpdatePropertyValue}
              />
            </div>
          ) : null}

          {rightPanelTab === 'ai' ? (
            <div className="right-pane__page right-pane__scroll">
              <SettingsPanel
                config={config}
                testingConnection={testingConnection}
                onChange={handleConfigChange}
                onTestConnection={handleTestConnection}
              />
              <ImportPanel
                importText={importText}
                externalPrompt={externalPrompt}
                onImportTextChange={setImportText}
                onApplyImport={handleApplyImport}
                onClearImport={() => setImportText('')}
                onCopyPrompt={handleCopyExternalPrompt}
              />
            </div>
          ) : null}
        </aside>
      </main>

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
