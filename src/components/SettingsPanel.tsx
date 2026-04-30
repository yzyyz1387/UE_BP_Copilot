import type { AppConfig, ConnectionMode } from '../types';

interface SettingsPanelProps {
  config: AppConfig;
  testingConnection?: boolean;
  onChange: (patch: Partial<AppConfig>) => void;
  onTestConnection?: () => void;
}

const CONNECTION_MODES: Array<{
  value: ConnectionMode;
  title: string;
  tag: string;
  summary: string;
  detail: string;
}> = [
  {
    value: 'direct',
    title: '浏览器直连',
    tag: 'Key 不经过本站',
    summary: '网页直接请求模型接口。最简单，也最透明。',
    detail: '要求模型服务商支持浏览器 CORS；如果控制台出现 preflight / Access-Control-Allow-Origin，请换成云端中转或本地代理。',
  },
  {
    value: 'cloud_proxy',
    title: '云端中转',
    tag: '解决 CORS',
    summary: '网页请求本站 /api/chat-proxy，再由 Serverless 转发到模型接口。',
    detail: '用户仍然填写自己的接口和 Key；本站代码只转发本次请求，不保存 Key 或请求体。Key 会经过本站 Serverless。复杂蓝图建议把请求超时调到 180 秒以上。',
  },
  {
    value: 'local_proxy',
    title: '本地代理',
    tag: '隐私优先',
    summary: '用户在电脑上运行一个 127.0.0.1 代理，网页只把请求发到本机。',
    detail: '适合不希望 Key 经过本站服务器的用户；需要先下载代理包并运行 node server.mjs。',
  },
];

const OUTPUT_FORMAT_OPTIONS: Array<{
  value: AppConfig['outputFormatMode'];
  title: string;
  hint: string;
}> = [
  {
    value: 'auto',
    title: '自动选择',
    hint: '官方 OpenAI 优先严格结构化；第三方兼容接口默认纯 JSON。',
  },
  {
    value: 'plain_json',
    title: '兼容纯 JSON',
    hint: '不发送 response_format，最适合 LongCat、DeepSeek 等兼容接口；中转/本地代理会尝试用上游流式收集降低网关超时。',
  },
  {
    value: 'json_object',
    title: 'JSON Object',
    hint: '发送 response_format=json_object，部分兼容服务支持。',
  },
  {
    value: 'json_schema',
    title: '严格 JSON Schema',
    hint: '结构最稳定，但很多兼容接口不支持，可能导致上游超时。',
  },
];

function getOutputFormatHint(mode: AppConfig['outputFormatMode']): string {
  return OUTPUT_FORMAT_OPTIONS.find((item) => item.value === mode)?.hint ?? OUTPUT_FORMAT_OPTIONS[0].hint;
}

function getModeInfo(mode: ConnectionMode) {
  return CONNECTION_MODES.find((item) => item.value === mode) ?? CONNECTION_MODES[0];
}

function getModeAlertClass(mode: ConnectionMode): string {
  if (mode === 'direct') return 'inline-alert inline-alert--warning';
  if (mode === 'cloud_proxy') return 'inline-alert inline-alert--info';
  return 'inline-alert inline-alert--success';
}

export function SettingsPanel({ config, testingConnection = false, onChange, onTestConnection }: SettingsPanelProps) {
  const currentMode = getModeInfo(config.connectionMode);

  const handleModeChange = (mode: ConnectionMode) => {
    onChange({
      connectionMode: mode,
      requestTimeoutMs: mode !== 'direct' && config.requestTimeoutMs < 180000 ? 180000 : config.requestTimeoutMs,
      localProxyUrl: mode === 'local_proxy' && !config.localProxyUrl.trim()
        ? 'http://127.0.0.1:8787'
        : config.localProxyUrl,
    });
  };

  return (
    <section className="section-card">
      <div className="section-card__header">
        <h3>接口设置</h3>
        <span className="panel-tag">{currentMode.title}</span>
      </div>

      <div className="connection-mode-grid" role="radiogroup" aria-label="连接方式">
        {CONNECTION_MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            className={`connection-mode-card${config.connectionMode === mode.value ? ' is-active' : ''}`}
            onClick={() => handleModeChange(mode.value)}
            role="radio"
            aria-checked={config.connectionMode === mode.value}
          >
            <span className="connection-mode-card__title">{mode.title}</span>
            <span className="connection-mode-card__tag">{mode.tag}</span>
            <span className="connection-mode-card__summary">{mode.summary}</span>
          </button>
        ))}
      </div>

      <div className={getModeAlertClass(config.connectionMode)}>
        <strong>{currentMode.title}：</strong>{currentMode.detail}
      </div>

      <div className="form-grid form-grid--spaced">
        <label className="form-field form-field--full">
          <span>模型接口地址</span>
          <input
            value={config.baseUrl}
            onChange={(event) => onChange({ baseUrl: event.target.value })}
            placeholder="https://api.openai.com/v1"
          />
        </label>

        <label className="form-field form-field--full">
          <span>用户自己的 API Key</span>
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
            placeholder="gpt-4o / longcat-xxx / deepseek-chat"
          />
        </label>

        <label className="form-field">
          <span>接口类型</span>
          <select
            value={config.apiMode}
            onChange={(event) =>
              onChange({
                apiMode: event.target.value as AppConfig['apiMode'],
              })
            }
          >
            <option value="chat_completions">chat/completions</option>
            <option value="responses">responses</option>
          </select>
        </label>

        <label className="form-field form-field--full">
          <span>输出格式策略</span>
          <select
            value={config.outputFormatMode}
            onChange={(event) =>
              onChange({
                outputFormatMode: event.target.value as AppConfig['outputFormatMode'],
              })
            }
          >
            {OUTPUT_FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.title}</option>
            ))}
          </select>
          <small>{getOutputFormatHint(config.outputFormatMode)}</small>
        </label>

        <label className="form-field">
          <span>请求超时</span>
          <select
            value={String(config.requestTimeoutMs)}
            onChange={(event) => onChange({ requestTimeoutMs: Number(event.target.value) })}
          >
            <option value="60000">60 秒</option>
            <option value="120000">120 秒</option>
            <option value="180000">180 秒（推荐）</option>
            <option value="240000">240 秒</option>
            <option value="300000">300 秒</option>
          </select>
          <small>云端中转依赖 Vercel 函数时长；新版默认按 300 秒函数配置，实际中转会预留少量返回时间。</small>
        </label>

        {config.connectionMode === 'local_proxy' ? (
          <label className="form-field form-field--full">
            <span>本地代理地址</span>
            <input
              value={config.localProxyUrl}
              onChange={(event) => onChange({ localProxyUrl: event.target.value })}
              placeholder="http://127.0.0.1:8787"
            />
          </label>
        ) : null}
      </div>

      <div className="settings-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onTestConnection}
          disabled={!onTestConnection || testingConnection}
        >
          {testingConnection ? '测试中...' : '测试连接'}
        </button>
        <span>测试会发送一个极小的“只返回 OK”请求，用来判断是否真的进入模型服务。</span>
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

      {config.connectionMode === 'local_proxy' ? (
        <div className="local-proxy-guide">
          <div className="local-proxy-guide__header">
            <div>
              <h4>本地代理部署教程</h4>
              <p>这个代理只跑在用户自己的电脑上，用来绕过第三方模型接口的浏览器 CORS 限制。</p>
            </div>
            <a className="primary-button" href="/downloads/ue-bp-copilot-local-proxy.zip" download>
              下载代理包
            </a>
          </div>

          <ol className="local-proxy-guide__steps">
            <li>下载并解压 <code>ue-bp-copilot-local-proxy.zip</code>。</li>
            <li>确认电脑已安装 Node.js 20 或更高版本。</li>
            <li>在代理目录中运行 <code>node server.mjs</code>。</li>
            <li>看到 <code>http://127.0.0.1:8787</code> 后，回到网页选择“本地代理”并开始生成。</li>
          </ol>

          <pre className="local-proxy-guide__code"><code>{'cd ue-bp-copilot-local-proxy\nnode server.mjs'}</code></pre>

          <p className="local-proxy-guide__note">
            本地代理不会保存 Key 或请求内容；网页会把你填写的接口地址、模型名、Key 和本次请求发送到本机代理，再由本机代理访问模型服务。
          </p>
        </div>
      ) : null}
    </section>
  );
}
