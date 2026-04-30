const MAX_BODY_BYTES = 2 * 1024 * 1024;
const ALLOWED_PATHS = new Set(['chat/completions', 'responses']);
const DEFAULT_ALLOWED_ORIGINS = [
  'https://ue-bp-copilot.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 55_000;

function getAllowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv]);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && getAllowedOrigins().has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-UE-BP-Proxy', 'cloud');
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body);
    } catch {
      throw new Error('请求体不是合法 JSON。');
    }
  }

  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error('请求体过大。');
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('请求体不是合法 JSON。');
  }
}

function normalizeOpenAiBaseUrl(baseUrl) {
  return String(baseUrl || '')
    .trim()
    .replace(/\/chat\/completions\/?$/i, '')
    .replace(/\/responses\/?$/i, '')
    .replace(/\/+$/, '');
}

function isPrivateHostname(hostname) {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower === '[::1]'
  ) {
    return true;
  }

  const ipv4 = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) {
    return false;
  }

  const [a, b] = ipv4.slice(1).map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254) ||
    (a === 192 && b === 168)
  );
}

function buildTargetUrl(baseUrl, path) {
  if (!ALLOWED_PATHS.has(path)) {
    throw new Error('不支持的接口路径。');
  }

  const normalizedBaseUrl = normalizeOpenAiBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    throw new Error('缺少模型接口地址。');
  }

  let url;
  try {
    url = new URL(normalizedBaseUrl);
  } catch {
    throw new Error('模型接口地址不是合法 URL。');
  }

  if (url.protocol !== 'https:') {
    throw new Error('云端中转只允许 https:// 模型接口。需要访问本机或内网接口时请使用本地代理模式。');
  }

  if (url.username || url.password) {
    throw new Error('模型接口地址不能包含用户名或密码。');
  }

  if (url.search || url.hash) {
    throw new Error('模型接口地址请填写 /v1 根地址，不要包含查询参数或 #hash。');
  }

  if (isPrivateHostname(url.hostname)) {
    throw new Error('云端中转不能请求 localhost 或内网地址。请使用本地代理模式。');
  }

  return {
    url: `${normalizedBaseUrl}/${path}`,
    host: url.hostname,
  };
}

function clampTimeoutMs(value) {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) return 45_000;
  return Math.min(Math.max(candidate, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
}

function parseProviderTimeout(text) {
  if (!text || !text.trim().startsWith('{')) return null;
  try {
    const payload = JSON.parse(text);
    if (
      payload &&
      typeof payload === 'object' &&
      payload.code !== undefined &&
      typeof payload.message === 'string' &&
      /timeout|timed out|SocketTimeoutException/i.test(`${payload.message} ${payload.data || ''}`)
    ) {
      return `${payload.message}${payload.data ? `（${payload.data}）` : ''}`;
    }
  } catch {
    // ignore non-json upstream body
  }
  return null;
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: { message: 'Method not allowed' } });
    return;
  }

  const length = Number(req.headers['content-length'] || 0);
  if (length > MAX_BODY_BYTES) {
    sendJson(res, 413, { error: { message: '请求体过大。' } });
    return;
  }

  let targetHost = '';
  let path = '';

  try {
    const payload = await readBody(req);
    const { baseUrl, apiKey, body, timeoutMs } = payload || {};
    path = payload?.path;

    if (!apiKey || typeof apiKey !== 'string') {
      sendJson(res, 400, { error: { message: '缺少 API Key。' } });
      return;
    }

    if (!body || typeof body !== 'object') {
      sendJson(res, 400, { error: { message: '缺少模型请求体。' } });
      return;
    }

    const target = buildTargetUrl(baseUrl, path);
    targetHost = target.host;
    const timeout = clampTimeoutMs(timeoutMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let upstream;
    try {
      upstream = await fetch(target.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        sendJson(res, 504, {
          error: {
            message: `云端中转等待上游模型服务超过 ${Math.round(timeout / 1000)} 秒。请求可能没有进入模型推理；请尝试“兼容纯 JSON”、缩短提示词，或切换本地代理。`,
            code: 'UPSTREAM_TIMEOUT',
          },
          proxy: { mode: 'cloud', targetHost, path },
        });
        return;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }

    const text = await upstream.text();
    const providerTimeout = parseProviderTimeout(text);
    if (providerTimeout) {
      sendJson(res, 504, {
        error: {
          message: `上游模型网关超时：${providerTimeout}。如果后台 token 用量没有变化，说明请求大概率卡在模型服务网关，建议改用“兼容纯 JSON”或本地代理。`,
          code: 'PROVIDER_TIMEOUT',
        },
        proxy: { mode: 'cloud', targetHost, path, upstreamStatus: upstream.status },
      });
      return;
    }

    if (upstream.ok && !text.trim()) {
      sendJson(res, 502, {
        error: {
          message: '上游模型服务返回了空响应。请检查模型名、接口类型，或改用“兼容纯 JSON”后重新测试连接。',
          code: 'EMPTY_UPSTREAM_RESPONSE',
        },
        proxy: { mode: 'cloud', targetHost, path, upstreamStatus: upstream.status },
      });
      return;
    }

    res.statusCode = upstream.status;
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    res.end(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, {
      error: { message, code: 'PROXY_ERROR' },
      proxy: { mode: 'cloud', targetHost, path },
    });
  }
}
