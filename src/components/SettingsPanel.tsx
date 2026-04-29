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
          <h3>接口设置</h3>
          <span className="panel-tag">浏览器直连</span>
        </div>

        <div className="inline-alert inline-alert--warning">
          请填写密钥；默认不会保存到浏览器。
        </div>

        <div className="form-grid">
          <label className="form-field form-field--full">
            <span>接口地址</span>
            <input
              value={config.baseUrl}
              onChange={(event) => onChange({ baseUrl: event.target.value })}
              placeholder="https://api.openai.com/v1"
            />
          </label>

          <label className="form-field form-field--full">
            <span>密钥</span>
            <input
              type="password"
              value={config.apiKey}
              onChange={(event) => onChange({ apiKey: event.target.value })}
              placeholder="sk-..."
            />
          </label>

          <label className="form-field">
            <span>模型</span>
            <input
              value={config.model}
              onChange={(event) => onChange({ model: event.target.value })}
              placeholder="gpt-5.2"
            />
          </label>

          <label className="form-field">
            <span>接口模式</span>
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
            <span>结构化输出不兼容时自动回退到纯 JSON 模式</span>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={config.persistApiKey}
              onChange={(event) => onChange({ persistApiKey: event.target.checked })}
            />
            <span>允许把密钥保存在本地浏览器（默认不保存）</span>
          </label>
        </div>
      </section>
    </>
  );
}
