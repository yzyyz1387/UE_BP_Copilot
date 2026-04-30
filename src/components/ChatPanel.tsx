import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  prompt: string;
  presets: string[];
  busy: boolean;
  editExistingGraph: boolean;
  compactedMessageCount: number;
  onPromptChange: (value: string) => void;
  onUsePreset: (value: string) => void;
  onEditExistingGraphChange: (value: boolean) => void;
  onSend: () => void;
  onClear: () => void;
}

export function ChatPanel({
  messages,
  prompt,
  presets,
  busy,
  editExistingGraph,
  compactedMessageCount,
  onPromptChange,
  onUsePreset,
  onEditExistingGraphChange,
  onSend,
  onClear,
}: ChatPanelProps) {
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = threadRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, busy]);

  return (
    <section className="section-card section-card--chat">
      <div className="section-card__header chat-header">
        <div>
          <h3>对话</h3>
          <p>支持连续追问；发送给 AI 时会保留最近对话，并把较早内容压缩成摘要。</p>
        </div>
        <button type="button" className="text-button" onClick={onClear}>
          清空会话
        </button>
      </div>

      {compactedMessageCount > 0 ? (
        <div className="inline-alert inline-alert--info chat-context-note">
          已有 {compactedMessageCount} 条较早对话会以压缩摘要形式进入上下文，最近消息保持原文优先。
        </div>
      ) : null}

      <div className="chat-thread" ref={threadRef}>
        {messages.map((message) => (
          <article
            key={message.id}
            className={`chat-bubble ${message.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant'}`}
          >
            <div className="chat-bubble__meta">
              <strong>{message.role === 'user' ? '你' : 'AI 助手'}</strong>
              <span>{message.createdAt}</span>
            </div>
            <p>{message.content}</p>
          </article>
        ))}
      </div>

      <label className="form-field chat-composer">
        <span>蓝图需求 / 追问</span>
        <textarea
          className="prompt-textarea"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="例如：基于当前蓝图，把毒气伤害改成每秒叠加；或在 默认用户/投掷物 文件夹中新建 BP_GasGrenade。"
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              onSend();
            }
          }}
        />
      </label>

      <div className="preset-row preset-row--compact">
        {presets.map((item) => (
          <button key={item} type="button" className="chip-button" onClick={() => onUsePreset(item)}>
            {item}
          </button>
        ))}
      </div>

      <div className="composer-footer">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={editExistingGraph}
            onChange={(e) => onEditExistingGraphChange(e.target.checked)}
          />
          <span>基于当前蓝图修改</span>
        </label>
        <button type="button" className="primary-button" onClick={onSend} disabled={busy}>
          {busy ? '生成中…' : '生成 / 继续'}
        </button>
      </div>
    </section>
  );
}
