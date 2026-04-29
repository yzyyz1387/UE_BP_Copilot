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
import { generateBlueprintPlan } from './lib/openaiClient';
import { buildExternalPromptTemplate } from './lib/prompt';
import { normalizeBlueprintWorkspaceResponse } from './lib/workspaceResponse';
import type {
  AppConfig,
  BlueprintLibrary,
  BlueprintOperationTarget,
  BlueprintPlan,
  BlueprintProject,
  BlueprintWorkspaceResponse,
  ChatMessage,
} from './types';

const DEFAULT_CONFIG: AppConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o',
  apiMode: 'chat_completions',
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

function timeString(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: crypto.randomUUID(), role, content, createdAt: timeString() };
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
  const [config, setConfig] = useState<AppConfig>(() => loadStoredConfig(DEFAULT_CONFIG));
  const [library, setLibrary] = useState<BlueprintLibrary>(() => loadStoredLibrary(DEMO_BLUEPRINT));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [plan, setPlan] = useState<BlueprintPlan>(() => normalizeBlueprintPlan(findActivePlan(loadStoredLibrary(DEMO_BLUEPRINT))));
  const [rawJson, setRawJson] = useState<string>(() => JSON.stringify(normalizeBlueprintPlan(findActivePlan(loadStoredLibrary(DEMO_BLUEPRINT))), null, 2));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(plan.nodes[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<InspectorTab>('notes');
  const [prompt, setPrompt] = useState<string>('做一个按下 E 打开门的 Actor 蓝图');
  const [importText, setImportText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage('assistant', '欢迎使用本地优先的 UE5 蓝图 AI 工作台。你可以创建不同用户/文件夹的蓝图，也可以让 AI 返回工作区操作自动新建或更新蓝图。'),
    createMessage('assistant', findActivePlan(loadStoredLibrary(DEMO_BLUEPRINT)).assistantReply),
  ]);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('本地前端模式 · 密钥默认不保存');
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

  const handleConfigChange = (patch: Partial<AppConfig>) =>
    setConfig((c) => ({ ...c, ...patch }));

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

  const setCurrentPlan = (nextPlan: BlueprintPlan, status: string, assistantText?: string) => {
    setPlan(nextPlan);
    setRawJson(JSON.stringify(nextPlan, null, 2));
    setSelectedNodeId(nextPlan.nodes[0]?.id ?? null);
    setActiveTab('notes');
    setStatusText(status);
    if (assistantText) setMessages((cur) => [...cur, createMessage('assistant', assistantText)]);
  };

  const applyPlan = (nextPlan: BlueprintPlan, sourceLabel: string, assistantText?: string) => {
    savePlanToActiveProject(nextPlan);
    setEndpointLabel(sourceLabel);
    setCurrentPlan(nextPlan, `已更新：${nextPlan.meta.title}`, assistantText);
  };

  const applyWorkspaceResponse = (response: BlueprintWorkspaceResponse, sourceLabel: string) => {
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

    const nextLibrary: BlueprintLibrary = {
      version: 1,
      activeProjectId: selectedProject.id,
      projects: nextProjects,
    };
    const selectedPlan = normalizeBlueprintPlan(selectedProject.plan);
    const status = descriptions.length > 1
      ? `已执行 ${descriptions.length} 个 AI 蓝图操作`
      : descriptions[0] || `已打开：${selectedProject.name}`;

    setLibrary(nextLibrary);
    setEndpointLabel(sourceLabel);
    setCurrentPlan(selectedPlan, status, response.assistantReply || selectedPlan.assistantReply);
    showToast(status, 'success');
  };

  const handleSelectProject = (projectId: string) => {
    const project = library.projects.find((item) => item.id === projectId);
    if (!project) return;
    const normalizedPlan = normalizeBlueprintPlan(project.plan);
    setLibrary((current) => ({ ...current, activeProjectId: projectId }));
    setEndpointLabel('本地存储');
    setCurrentPlan(normalizedPlan, `已打开：${project.name}`);
    setMessages([
      createMessage('assistant', `已打开“${project.name}”。这个蓝图归档在 ${project.userName} / ${project.folderPath}。`),
      createMessage('assistant', normalizedPlan.assistantReply),
    ]);
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

    setLibrary((current) => ({
      ...current,
      activeProjectId: project.id,
      projects: [...current.projects, project],
    }));
    setEndpointLabel('本地新建');
    setCurrentPlan(nextPlan, `已新建：${name}`, nextPlan.assistantReply);
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

    setLibrary((current) => ({
      ...current,
      activeProjectId: project.id,
      projects: [...current.projects, project],
    }));
    setEndpointLabel('本地复制');
    setCurrentPlan(nextPlan, `已复制：${name}`, '已把当前蓝图复制成新的本地文件。');
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

    setLibrary({ version: 1, activeProjectId: nextActive.id, projects: remaining });
    setEndpointLabel('本地存储');
    setCurrentPlan(nextPlan, `已删除，当前打开：${nextActive.name}`, `已删除“${activeProject.name}”，并打开“${nextActive.name}”。`);
  };

  const handleLoadDemo = () => {
    const demoPlan = normalizeBlueprintPlan(DEMO_BLUEPRINT);
    savePlanToActiveProject(demoPlan);
    setEndpointLabel('示例');
    setMessages([
      createMessage('assistant', '已重置到本地示例图。你可以直接覆盖需求，也可以勾选“基于当前蓝图继续修改”让模型沿着当前图继续迭代。'),
      createMessage('assistant', DEMO_BLUEPRINT.assistantReply),
    ]);
    setCurrentPlan(demoPlan, '已载入本地示例图');
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
      applyWorkspaceResponse(workspaceResponse, '导入工作区 JSON');
    } catch (reason) {
      showToast(`导入 JSON 失败：${reason instanceof Error ? reason.message : '未知错误'}`, 'error');
      setStatusText('导入失败');
    }
  };

  const handleClearChat = () => {
    setMessages([createMessage('assistant', '会话已清空。你可以重新描述需求，也可以保留当前蓝图继续修改。')]);
    setStatusText('会话已清空');
  };

  const handleSend = async () => {
    const userPrompt = prompt.trim();
    if (!userPrompt) { showToast('请先输入你想生成的蓝图需求。', 'error'); return; }
    if (!config.apiKey.trim()) { showToast('请先在右侧接口设置中填写密钥。', 'error'); return; }

    const userMessage = createMessage('user', userPrompt);
    const history = [...messages, userMessage];
    setMessages(history);
    setBusy(true);
    setStatusText('正在调用模型生成蓝图工作区操作...');

    try {
      const result = await generateBlueprintPlan({ config, userPrompt, currentPlan: plan, history, library });
      applyWorkspaceResponse(result.response, result.endpointLabel);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '生成失败';
      showToast(message, 'error');
      setStatusText('生成失败');
      setMessages((cur) => [...cur, createMessage('assistant', `这次生成失败了：${message}`)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <ProjectSidebar
        library={library}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onDuplicateProject={handleDuplicateProject}
        onDeleteProject={handleDeleteProject}
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
          <div className="right-pane__scroll">
            <SettingsPanel config={config} onChange={handleConfigChange} />
            <ImportPanel
              importText={importText}
              externalPrompt={externalPrompt}
              onImportTextChange={setImportText}
              onApplyImport={handleApplyImport}
              onClearImport={() => setImportText('')}
              onCopyPrompt={handleCopyExternalPrompt}
            />
            <InspectorTabs
              plan={plan}
              selectedNode={selectedNode}
              activeTab={activeTab}
              rawJson={rawJson}
              onChangeTab={setActiveTab}
              onFocusNode={(nodeId) => { setSelectedNodeId(nodeId); setActiveTab('notes'); }}
            />
          </div>

          <div className="right-pane__chat">
            <ChatPanel
              messages={messages}
              prompt={prompt}
              presets={PRESET_PROMPTS}
              busy={busy}
              editExistingGraph={config.editExistingGraph}
              onPromptChange={setPrompt}
              onUsePreset={setPrompt}
              onEditExistingGraphChange={(v) => handleConfigChange({ editExistingGraph: v })}
              onSend={handleSend}
              onClear={handleClearChat}
            />
          </div>
        </aside>
      </main>

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
