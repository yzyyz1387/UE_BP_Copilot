import type { AppConfig } from '../types';

interface SettingsPanelProps {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}

export function SettingsPanel({ config, onChange }: SettingsPanelProps) {
  return (
    <>
      <section className="section-card">
        <div className="section-card__header">
          <h3>API 设置</h3>
          <span className="panel-tag">纯前端直连</span>
        </div>

        <div className="inline-alert inline-alert--warning">
          请设置 Key ...
        </div>

        <div className="form-grid">
          <label className="form-field form-field--full">
            <span>Base URL</span>
            <input
              value={config.baseUrl}
              onChange={(event) => onChange({ baseUrl: event.target.value })}
              placeholder="https://api.openai.com/v1"
            />
          </label>

          <label className="form-field form-field--full">
            <span>API Key</span>
            <input
              type="password"
              value={config.apiKey}
              onChange={(event) => onChange({ apiKey: event.target.value })}
              placeholder="sk-..."
            />
          </label>

          <label className="form-field">
            <span>Model</span>
            <input
              value={config.model}
              onChange={(event) => onChange({ model: event.target.value })}
              placeholder="gpt-5.2"
            />
          </label>

          <label className="form-field">
            <span>API 模式</span>
            <select
              value={config.apiMode}
              onChange={(event) =>
                onChange({
                  apiMode: event.target.value as AppConfig['apiMode'],
                })
              }
            >
              <option value="responses">responses</option>
              <option value="chat_completions">chat/completions</option>
            </select>
          </label>
        </div>

        <div className="toggle-row">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={config.allowJsonFallback}
              onChange={(event) => onChange({ allowJsonFallback: event.target.checked })}
            />
            <span>当结构化输出不兼容时，自动回退到 JSON-only 模式</span>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={config.persistApiKey}
              onChange={(event) => onChange({ persistApiKey: event.target.checked })}
            />
            <span>允许把 API Key 保存在本地浏览器（默认不保存）</span>
          </label>
        </div>
      </section>
    </>
  );
}
