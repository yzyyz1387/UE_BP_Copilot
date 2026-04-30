import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const ALLOWED_PATHS = new Set(['chat/completions', 'responses']);
const DEFAULT_ALLOWED_ORIGINS = [
  'https://ue-bp-copilot.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 300_000;

function getAllowedOrigins() {
  const extra = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra]);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && getAllowedOrigins().has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-UE-BP-Proxy', 'local');
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求体过大。'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new Error('请求体不是合法 JSON。'));
      }
    });

    req.on('error', reject);
  });
}

function normalizeOpenAiBaseUrl(baseUrl) {
  return String(baseUrl || '')
    .trim()
    .replace(/\/chat\/completions\/?$/i, '')
    .replace(/\/responses\/?$/i, '')
    .replace(/\/+$/, '');
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

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('模型接口地址只支持 http:// 或 https://。');
  }

  if (url.username || url.password) {
    throw new Error('模型接口地址不能包含用户名或密码。');
  }

  if (url.search || url.hash) {
    throw new Error('模型接口地址请填写 /v1 根地址，不要包含查询参数或 #hash。');
  }

  return {
    url: `${normalizedBaseUrl}/${path}`,
    host: url.hostname,
  };
}

function clampTimeoutMs(value) {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) return 180_000;
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
    // ignore
  }
  return null;
}

function textFromDeltaContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      if (typeof part.text === 'string') return part.text;
      if (typeof part.content === 'string') return part.content;
      if (typeof part.value === 'string') return part.value;
      return '';
    })
    .join('');
}

async function readOpenAiSseCompletion(upstream) {
  const reader = upstream.body?.getReader?.();
  if (!reader) {
    return { text: await upstream.text(), finishReason: 'stop', usage: null, streamed: false };
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let deltaContent = '';
  let messageContentSnapshot = '';
  let legacyText = '';
  let deltaReasoningContent = '';
  let messageReasoningSnapshot = '';
  let finishReason = '';
  let usage = null;

  const mergeSnapshotOrChunks = (current, incoming) => {
    if (!incoming) return current;
    if (!current) return incoming;
    if (incoming === current) return current;
    // Some OpenAI-compatible gateways send an accumulated message.content snapshot
    // in stream chunks. Treat a growing prefix as a replacement, not as another chunk.
    if (incoming.startsWith(current)) return incoming;
    if (current.startsWith(incoming) || current.endsWith(incoming)) return current;
    return current + incoming;
  };

  const pickFinalText = (deltaText, snapshotText, fallbackText) => {
    if (snapshotText && deltaText) {
      if (snapshotText === deltaText || snapshotText.startsWith(deltaText) || deltaText.startsWith(snapshotText)) {
        return snapshotText.length >= deltaText.length ? snapshotText : deltaText;
      }
      // If both contain a full JSON object, prefer the longer complete-looking text,
      // but never concatenate them; concatenating causes "{...}{...}" parse errors.
      return snapshotText.length >= deltaText.length ? snapshotText : deltaText;
    }
    return deltaText || snapshotText || fallbackText;
  };

  const handleEventPayload = (payload) => {
    const data = payload.trim();
    if (!data || data === '[DONE]') return;

    let chunk;
    try {
      chunk = JSON.parse(data);
    } catch {
      return;
    }

    if (chunk?.error) {
      const message =
        typeof chunk.error === 'string'
          ? chunk.error
          : chunk.error?.message || '上游流式响应返回错误。';
      throw new Error(message);
    }

    if (chunk?.usage) {
      usage = chunk.usage;
    }

    const choice = Array.isArray(chunk?.choices) ? chunk.choices[0] : undefined;
    if (!choice) return;

    const deltaText = textFromDeltaContent(choice.delta?.content);
    const messageText = textFromDeltaContent(choice.message?.content);
    const deltaReasoning =
      textFromDeltaContent(choice.delta?.reasoning_content) || textFromDeltaContent(choice.delta?.reasoning);
    const messageReasoning =
      textFromDeltaContent(choice.message?.reasoning_content) || textFromDeltaContent(choice.message?.reasoning);

    if (deltaText) deltaContent += deltaText;
    if (messageText) messageContentSnapshot = mergeSnapshotOrChunks(messageContentSnapshot, messageText);
    if (deltaReasoning) deltaReasoningContent += deltaReasoning;
    if (messageReasoning) messageReasoningSnapshot = mergeSnapshotOrChunks(messageReasoningSnapshot, messageReasoning);
    if (typeof choice.text === 'string') legacyText += choice.text;
    if (choice.finish_reason) finishReason = choice.finish_reason;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (trimmed.startsWith('data:')) {
        handleEventPayload(trimmed.slice(5));
      }
    }
  }

  const tail = (buffer + decoder.decode()).trim();
  if (tail.startsWith('data:')) {
    handleEventPayload(tail.slice(5));
  }

  return {
    text: pickFinalText(deltaContent, messageContentSnapshot, legacyText),
    reasoningText: pickFinalText(deltaReasoningContent, messageReasoningSnapshot, ''),
    finishReason: finishReason || 'stop',
    usage,
    streamed: true,
  };
}

async function forwardNonStream({ target, apiKey, body, signal }) {
  return fetch(target.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
}

async function forwardChatCompletionsAsUpstreamStream({ target, apiKey, body, signal }) {
  const upstream = await fetch(target.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });

  const contentType = upstream.headers.get('content-type') || '';
  if (!upstream.ok || !contentType.includes('text/event-stream')) {
    return upstream;
  }

  const completion = await readOpenAiSseCompletion(upstream);
  return new Response(
    JSON.stringify({
      id: `chatcmpl-proxy-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body?.model || 'unknown',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: completion.text,
            ...(completion.reasoningText ? { reasoning_content: completion.reasoningText } : {}),
          },
          finish_reason: completion.finishReason,
        },
      ],
      ...(completion.usage ? { usage: completion.usage } : {}),
      proxy: { upstreamStreamCollected: true },
    }),
    {
      status: upstream.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    },
  );
}

async function handleProxy(req, res) {
  const payload = await readBody(req);
  const { baseUrl, apiKey, path, body, timeoutMs, streamUpstream } = payload || {};

  if (!apiKey || typeof apiKey !== 'string') {
    sendJson(res, 400, { error: { message: '缺少 API Key。' } });
    return;
  }

  if (!body || typeof body !== 'object') {
    sendJson(res, 400, { error: { message: '缺少模型请求体。' } });
    return;
  }

  const target = buildTargetUrl(baseUrl, path);
  const timeout = clampTimeoutMs(timeoutMs);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let upstream;
  try {
    upstream =
      streamUpstream && path === 'chat/completions'
        ? await forwardChatCompletionsAsUpstreamStream({ target, apiKey, body, signal: controller.signal })
        : await forwardNonStream({ target, apiKey, body, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      sendJson(res, 504, {
        error: {
          message: `本地代理等待上游模型服务超过 ${Math.round(timeout / 1000)} 秒。请求已经可能进入模型推理，但未能在超时前返回完整结果。请调高请求超时或缩短提示词。`,
          code: 'UPSTREAM_TIMEOUT',
        },
        proxy: { mode: 'local', targetHost: target.host, path, timeoutMs: timeout },
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
        message: `上游模型网关超时：${providerTimeout}。建议保留上游流式收集、缩短提示词后重试。`,
        code: 'PROVIDER_TIMEOUT',
      },
      proxy: { mode: 'local', targetHost: target.host, path, upstreamStatus: upstream.status },
    });
    return;
  }

  if (upstream.ok && !text.trim()) {
    sendJson(res, 502, {
      error: {
        message: '上游模型服务返回了空响应。请检查模型名、接口类型，或改用“兼容纯 JSON”后重新测试连接。',
        code: 'EMPTY_UPSTREAM_RESPONSE',
      },
      proxy: { mode: 'local', targetHost: target.host, path, upstreamStatus: upstream.status },
    });
    return;
  }

  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
  });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      ok: true,
      name: 'ue-bp-copilot-local-proxy',
      listen: `http://127.0.0.1:${PORT}`,
      maxTimeoutSeconds: Math.round(MAX_TIMEOUT_MS / 1000),
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/proxy/openai') {
    try {
      await handleProxy(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { error: { message, code: 'PROXY_ERROR' } });
    }
    return;
  }

  sendJson(res, 404, { error: { message: 'Not found' } });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`UE BP Copilot local proxy running at http://127.0.0.1:${PORT}`);
  console.log('Open the web app, choose 本地代理, and keep this terminal open.');
});
