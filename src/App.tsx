import { useEffect, useMemo, useState } from 'react';
import { BlueprintCanvas } from './components/BlueprintCanvas';
import { ChatPanel } from './components/ChatPanel';
import { HeaderBar } from './components/HeaderBar';
import { ImportPanel } from './components/ImportPanel';
import { InspectorTabs, type InspectorTab } from './components/InspectorTabs';
import { SettingsPanel } from './components/SettingsPanel';
import { Toast, useToast } from './components/Toast';
import { DEMO_BLUEPRINT } from './data/demoBlueprint';
import { loadStoredConfig, storeConfig, loadStoredPlan, storePlan } from './lib/localStorage';
import { normalizeBlueprintPlan } from './lib/blueprintTransform';
import { generateBlueprintPlan } from './lib/openaiClient';
import { buildExternalPromptTemplate } from './lib/prompt';
import type { AppConfig, BlueprintPlan, ChatMessage } from './types';

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
  '做一个角色按 Shift 奔跑的 Character 蓝图',
  '做一个 Widget 按钮切换面板显示隐藏',
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

export default function App() {
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();
  const [config, setConfig] = useState<AppConfig>(() => loadStoredConfig(DEFAULT_CONFIG));
  const [plan, setPlan] = useState<BlueprintPlan>(() => {
    const stored = loadStoredPlan();
    if (stored) {
      try { return normalizeBlueprintPlan(stored); } catch { /* fall through */ }
    }
    return DEMO_BLUEPRINT;
  });
  const [rawJson, setRawJson] = useState<string>(() => JSON.stringify(
    (() => { const s = loadStoredPlan(); if (s) { try { return normalizeBlueprintPlan(s); } catch { /**/ } } return DEMO_BLUEPRINT; })(),
    null, 2,
  ));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(plan.nodes[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<InspectorTab>('notes');
  const [prompt, setPrompt] = useState<string>('做一个按下 E 打开门的 Actor 蓝图');
  const [importText, setImportText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage('assistant', '欢迎。你可以直接描述你要的 UE5 蓝图逻辑，我会同时生成左侧节点图和右侧的新手提示、变量建议。'),
    createMessage('assistant', DEMO_BLUEPRINT.assistantReply),
  ]);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('本地前端模式 · API Key 默认不保存');
  const [endpointLabel, setEndpointLabel] = useState('');

  useEffect(() => { storeConfig(config); }, [config]);
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

  const applyPlan = (nextPlan: BlueprintPlan, sourceLabel: string, assistantText?: string) => {
    setPlan(nextPlan);
    setRawJson(JSON.stringify(nextPlan, null, 2));
    setSelectedNodeId(nextPlan.nodes[0]?.id ?? null);
    setActiveTab('notes');
    setEndpointLabel(sourceLabel);
    setStatusText(`已更新：${nextPlan.meta.title}`);
    if (assistantText) setMessages((cur) => [...cur, createMessage('assistant', assistantText)]);
  };

  const handleLoadDemo = () => {
    setPlan(DEMO_BLUEPRINT);
    setRawJson(JSON.stringify(DEMO_BLUEPRINT, null, 2));
    setSelectedNodeId(DEMO_BLUEPRINT.nodes[0]?.id ?? null);
    setActiveTab('notes');
    setStatusText('已载入本地示例图');
    setEndpointLabel('demo');
    setMessages([
      createMessage('assistant', '已重置到本地示例图。你可以直接覆盖需求，也可以勾选"基于当前蓝图继续修改"让模型沿着当前图继续迭代。'),
      createMessage('assistant', DEMO_BLUEPRINT.assistantReply),
    ]);
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
      showToast('已复制外部 AI Prompt', 'success');
    } catch {
      showToast('Prompt 复制失败', 'error');
    }
  };

  const handleApplyImport = () => {
    try {
      const parsed = JSON.parse(extractJsonString(importText));
      applyPlan(normalizeBlueprintPlan(parsed), 'imported-json', '已导入外部 JSON，并更新为当前蓝图。');
    } catch (reason) {
      showToast(`导入 JSON 失败：${reason instanceof Error ? reason.message : '未知错误'}`, 'error');
      setStatusText('导入失败');
    }
  };

  const handleClearChat = () => {
    setMessages([createMessage('assistant', '会话已清空。你可以重新描述需求，也可以保留当前左侧蓝图继续修改。')]);
    setStatusText('会话已清空');
  };

  const handleSend = async () => {
    const userPrompt = prompt.trim();
    if (!userPrompt) { showToast('请先输入你想生成的蓝图需求。', 'error'); return; }
    if (!config.apiKey.trim()) { showToast('请先在右侧 API 设置中填写 API Key。', 'error'); return; }

    const userMessage = createMessage('user', userPrompt);
    const history = [...messages, userMessage];
    setMessages(history);
    setBusy(true);
    setStatusText('正在调用模型生成蓝图...');

    try {
      const result = await generateBlueprintPlan({ config, userPrompt, currentPlan: plan, history });
      applyPlan(result.plan, result.endpointLabel, result.plan.assistantReply);
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
          <BlueprintCanvas plan={plan} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
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
