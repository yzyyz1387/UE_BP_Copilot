import type { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  prompt: string;
  presets: string[];
  busy: boolean;
  editExistingGraph: boolean;
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
  onPromptChange,
  onUsePreset,
  onEditExistingGraphChange,
  onSend,
  onClear,
}: ChatPanelProps) {
  return (
    <section className="section-card section-card--chat">
      <div className="section-card__header">
        <h3>蓝图助手</h3>
        <button type="button" className="text-button" onClick={onClear}>
          清空会话
        </button>
      </div>

      <div className="chat-thread">
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

      <label className="form-field">
        <span>蓝图需求</span>
        <textarea
          className="prompt-textarea"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="例如：在 默认用户/投掷物 文件夹中新建 BP_GasGrenade 毒气弹蓝图；或基于当前蓝图继续修改。"
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
          {busy ? '生成中…' : '生成'}
        </button>
      </div>
    </section>
  );
}
