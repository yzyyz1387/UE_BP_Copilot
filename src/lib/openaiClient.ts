import { OUTPUT_SHAPE_GUIDE, SYSTEM_PROMPT, UE_BLUEPRINT_WORKSPACE_RESPONSE_SCHEMA } from '../schema';
import type { AppConfig, BlueprintLibrary, BlueprintPlan, BlueprintWorkspaceResponse, ChatMessage, GenerationResult } from '../types';
import { buildGenerationPrompt } from './prompt';
import { normalizeBlueprintWorkspaceResponse } from './workspaceResponse';

interface GenerateArgs {
  config: AppConfig;
  userPrompt: string;
  currentPlan: BlueprintPlan;
  history: ChatMessage[];
  library: BlueprintLibrary;
}

type OpenAiPath = 'responses' | 'chat/completions';
type OutputFlavor = 'json_schema' | 'json_object' | 'plain_json';

interface ProxyPayload {
  baseUrl: string;
  apiKey: string;
  path: OpenAiPath;
  body: unknown;
  timeoutMs?: number;
  streamUpstream?: boolean;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  endpointLabel: string;
  rawText: string;
}

const LOCAL_PROXY_FALLBACK_URL = 'http://127.0.0.1:8787';
const MIN_REQUEST_TIMEOUT_MS = 10_000;
const MAX_REQUEST_TIMEOUT_MS = 300_000;

function normalizeOpenAiBaseUrl(baseUrl: string): string {
  return baseUrl
    .trim()
    .replace(/\/chat\/completions\/?$/i, '')
    .replace(/\/responses\/?$/i, '')
    .replace(/\/+$/, '');
}

function joinUrl(baseUrl: string, path: string): string {
  return `${normalizeOpenAiBaseUrl(baseUrl)}/${path.replace(/^\/+/, '')}`;
}

function joinPlainUrl(baseUrl: string, path: string): string {
  return `${baseUrl.trim().replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function connectionModeLabel(config: AppConfig): string {
  if (config.connectionMode === 'cloud_proxy') return '云端中转';
  if (config.connectionMode === 'local_proxy') return '本地代理';
  return '浏览器直连';
}

function outputModeLabel(config: AppConfig): string {
  if (config.outputFormatMode === 'json_schema') return '严格 JSON Schema';
  if (config.outputFormatMode === 'json_object') return 'JSON Object';
  if (config.outputFormatMode === 'plain_json') return '兼容纯 JSON';
  return '自动选择';
}

function getProxyEndpoint(config: AppConfig): string {
  if (config.connectionMode === 'cloud_proxy') {
    return '/api/chat-proxy';
  }

  return joinPlainUrl(config.localProxyUrl.trim() || LOCAL_PROXY_FALLBACK_URL, 'proxy/openai');
}

function getRequestTimeoutMs(config: AppConfig): number {
  const candidate = Number(config.requestTimeoutMs);
  if (!Number.isFinite(candidate)) return 180_000;
  return Math.min(Math.max(candidate, MIN_REQUEST_TIMEOUT_MS), MAX_REQUEST_TIMEOUT_MS);
}

function isLikelyOfficialOpenAiBaseUrl(baseUrl: string): boolean {
  try {
    const url = new URL(normalizeOpenAiBaseUrl(baseUrl));
    return url.hostname === 'api.openai.com';
  } catch {
    return false;
  }
}

function dedupeFlavors(flavors: OutputFlavor[]): OutputFlavor[] {
  return Array.from(new Set(flavors));
}

function getOutputFlavors(config: AppConfig, path: OpenAiPath): OutputFlavor[] {
  const withFallback = (primary: OutputFlavor, fallback: OutputFlavor[]): OutputFlavor[] =>
    config.allowJsonFallback ? dedupeFlavors([primary, ...fallback]) : [primary];

  if (config.outputFormatMode === 'plain_json') {
    return ['plain_json'];
  }

  if (path === 'responses') {
    if (config.outputFormatMode === 'json_schema') {
      return withFallback('json_schema', ['plain_json']);
    }
    // Responses API 没有通用 json_object 兼容参数；第三方兼容服务直接走纯 JSON 最稳。
    if (config.outputFormatMode === 'json_object') {
      return ['plain_json'];
    }
    return isLikelyOfficialOpenAiBaseUrl(config.baseUrl)
      ? withFallback('json_schema', ['plain_json'])
      : ['plain_json'];
  }

  if (config.outputFormatMode === 'json_schema') {
    return withFallback('json_schema', ['json_object', 'plain_json']);
  }

  if (config.outputFormatMode === 'json_object') {
    return withFallback('json_object', ['plain_json']);
  }

  // 自动模式：官方 OpenAI 优先严格结构化；第三方 OpenAI-compatible 默认不要发送 response_format，避免网关超时。
  return isLikelyOfficialOpenAiBaseUrl(config.baseUrl)
    ? withFallback('json_schema', ['json_object', 'plain_json'])
    : ['plain_json'];
}

function flavorLabel(flavor: OutputFlavor): string {
  if (flavor === 'json_schema') return 'workspace schema';
  if (flavor === 'json_object') return 'workspace json_object fallback';
  return 'workspace plain-json fallback';
}

function providerErrorMessage(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const payload = parsed as {
    error?: { message?: string; code?: string | number; type?: string } | string;
    code?: string | number;
    message?: string;
    data?: string;
    choices?: unknown;
    output?: unknown;
    output_text?: unknown;
  };

  if (payload.choices || payload.output || payload.output_text) {
    return null;
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim();
  }

  if (payload.error && typeof payload.error === 'object' && payload.error.message) {
    const code = payload.error.code ? `（${payload.error.code}）` : '';
    return `${payload.error.message}${code}`;
  }

  if (payload.message && (payload.code !== undefined || payload.data)) {
    const code = payload.code !== undefined ? `code=${payload.code}` : '';
    const data = payload.data ? `，data=${payload.data}` : '';
    return `${payload.message}${code || data ? `（${code}${data}）` : ''}`;
  }

  return null;
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`请求超时（${Math.round(timeoutMs / 1000)} 秒）。如果使用云端中转，请优先把“输出格式策略”改成“兼容纯 JSON”，或切换到本地代理。`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message || '网络请求失败。');
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let parsed: unknown = null;

  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  const providerError = providerErrorMessage(parsed);
  if (!response.ok || providerError) {
    const errorMessage =
      providerError ??
      (parsed as { error?: { message?: string } } | null)?.error?.message ??
      (parsed as { message?: string } | null)?.message ??
      text ??
      `HTTP ${response.status}`;
    throw new Error(errorMessage || `HTTP ${response.status}`);
  }

  return parsed ?? {};
}

async function postModelJson(
  config: AppConfig,
  path: OpenAiPath,
  body: unknown,
  options: { streamUpstream?: boolean } = {},
): Promise<unknown> {
  const apiKey = config.apiKey.trim();
  const timeoutMs = getRequestTimeoutMs(config);

  if (config.connectionMode === 'direct') {
    return fetchJson(joinUrl(config.baseUrl, path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }, timeoutMs);
  }

  const payload: ProxyPayload = {
    baseUrl: normalizeOpenAiBaseUrl(config.baseUrl),
    apiKey,
    path,
    body,
    timeoutMs,
    streamUpstream: options.streamUpstream,
  };

  return fetchJson(getProxyEndpoint(config), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, Math.min(timeoutMs + 15_000, MAX_REQUEST_TIMEOUT_MS + 15_000));
}

function extractJsonString(text: string): string {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error('模型返回为空。');
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new Error('无法从模型返回中提取 JSON。');
}

function parseWorkspaceResponse(rawText: string, structured?: unknown): BlueprintWorkspaceResponse {
  if (structured && typeof structured === 'object') {
    return normalizeBlueprintWorkspaceResponse(structured);
  }

  return normalizeBlueprintWorkspaceResponse(JSON.parse(extractJsonString(rawText)));
}

function extractTextFromResponseApi(data: unknown): string {
  const error = providerErrorMessage(data);
  if (error) throw new Error(error);

  const payload = data as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ text?: string; value?: string; content?: string }>;
    }>;
  };

  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  const chunks: string[] = [];
  for (const block of payload.output ?? []) {
    for (const part of block.content ?? []) {
      if (typeof part.text === 'string') {
        chunks.push(part.text);
      } else if (typeof part.value === 'string') {
        chunks.push(part.value);
      } else if (typeof part.content === 'string') {
        chunks.push(part.content);
      }
    }
  }

  return chunks.join('\n').trim();
}

function extractTextFromChatCompletions(data: unknown): string {
  const error = providerErrorMessage(data);
  if (error) throw new Error(error);

  const payload = data as {
    choices?: Array<{
      message?: {
        refusal?: string;
        content?:
          | string
          | Array<{
              text?: string;
              content?: string;
            }>;
      };
      text?: string;
    }>;
  };

  const choice = payload.choices?.[0];
  const message = choice?.message;
  if (typeof message?.refusal === 'string' && message.refusal) {
    throw new Error(`模型拒绝返回结构化结果：${message.refusal}`);
  }

  if (typeof message?.content === 'string') {
    return message.content;
  }

  if (Array.isArray(message?.content)) {
    return message.content
      .map((item) => item.text ?? item.content ?? '')
      .join('\n')
      .trim();
  }

  if (typeof choice?.text === 'string') {
    return choice.text;
  }

  return '';
}

function buildCompatPrompt(prompt: string): string {
  return [
    prompt,
    '',
    '兼容模式要求：',
    '1. 只返回一个 JSON 对象。',
    '2. 不要输出 Markdown，不要输出注释。',
    '3. 根对象必须是 BlueprintWorkspaceResponse：responseType 固定为 blueprint_workspace_operation，operations 至少一项。',
    '4. 如果要覆盖当前蓝图，返回 action=replace_current_blueprint；如果要新增到用户/文件夹，返回 action=create_blueprint。',
    '5. 每个 operation.plan 都必须是完整 BlueprintPlan，assistantReply 要简短，不要逐节点解释。',
    '6. node.comment 默认空字符串，只有关键节点才填写短注释。',
    '7. variables 只放需要用户创建的变量；UE 自带属性或组件默认值调整必须放入 properties，owner 写 Self 或组件名。',
    '8. 字段结构必须满足：',
    OUTPUT_SHAPE_GUIDE,
  ].join('\n');
}

function getTroubleshootingText(config: AppConfig): string {
  const common = [
    `输出格式策略：${outputModeLabel(config)}。`,
    config.outputFormatMode === 'auto'
      ? '自动模式下，第三方 OpenAI-compatible 接口默认走“兼容纯 JSON”，不会发送 response_format/json_schema。'
      : '',
  ].filter(Boolean);

  if (config.connectionMode === 'direct') {
    return [
      '当前连接方式：浏览器直连。',
      ...common,
      '如果浏览器控制台出现 CORS / preflight / No Access-Control-Allow-Origin，请切换到“云端中转”或“本地代理”。',
      '直连模式要求模型服务商允许网页跨域请求，而且密钥会暴露在浏览器 DevTools 中，只建议个人本地测试。',
    ].join('\n');
  }

  if (config.connectionMode === 'cloud_proxy') {
    return [
      '当前连接方式：云端中转。',
      ...common,
      '请确认接口地址是 OpenAI-compatible 的 /v1 根地址，例如 https://api.example.com/v1。',
      '如果模型后台 token 用量没有变化，通常表示请求卡在兼容网关或中转到上游之间；请优先使用“兼容纯 JSON”并点“测试连接”。如果 token 用量有变化但仍超时，通常是生成耗时超过当前云函数时限，请把请求超时调到 180 秒以上，或使用本地代理。',
      '本站中转函数只转发本次请求，前端代码不会保存密钥；但密钥会经过本站 Serverless。',
    ].join('\n');
  }

  return [
    '当前连接方式：本地代理。',
    ...common,
    '请先下载并运行本地代理，然后确认代理地址是 http://127.0.0.1:8787。',
    '如果仍然失败，请检查本地代理终端日志、模型接口地址、模型名和密钥。',
  ].join('\n');
}

function decorateError(error: unknown, endpointLabel: string, config: AppConfig): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(
    `${message}\n\n请求方式：${connectionModeLabel(config)} · ${endpointLabel}\n可排查：\n1. 接口地址是否写成完整的 /v1 根地址\n2. 模型名是否可用\n3. 第三方兼容服务是否支持 response_format；不确定时用“兼容纯 JSON”\n4. 当前请求是否在 ${Math.round(getRequestTimeoutMs(config) / 1000)} 秒内返回\n5. ${getTroubleshootingText(config)}`,
  );
}

function buildResponseApiBody(config: AppConfig, prompt: string, flavor: OutputFlavor): unknown {
  if (flavor === 'json_schema') {
    return {
      model: config.model,
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'ue_blueprint_workspace_response',
          strict: true,
          schema: UE_BLUEPRINT_WORKSPACE_RESPONSE_SCHEMA,
        },
      },
    };
  }

  return {
    model: config.model,
    input: [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\n你当前运行在兼容纯 JSON 模式下，必须只返回 JSON 对象，不要输出 Markdown。`,
      },
      { role: 'user', content: buildCompatPrompt(prompt) },
    ],
  };
}

function buildChatCompletionsBody(config: AppConfig, prompt: string, flavor: OutputFlavor): unknown {
  const compatMessages = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n你当前运行在兼容模式下，必须只返回 JSON 对象，不要输出 Markdown。`,
    },
    { role: 'user', content: buildCompatPrompt(prompt) },
  ];

  if (flavor === 'json_schema') {
    return {
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ue_blueprint_workspace_response',
          strict: true,
          schema: UE_BLUEPRINT_WORKSPACE_RESPONSE_SCHEMA,
        },
      },
    };
  }

  if (flavor === 'json_object') {
    return {
      model: config.model,
      messages: compatMessages,
      response_format: {
        type: 'json_object',
      },
    };
  }

  return {
    model: config.model,
    messages: compatMessages,
  };
}

function shouldStopAfterFirstFailure(config: AppConfig, flavors: OutputFlavor[], index: number): boolean {
  return !config.allowJsonFallback || index >= flavors.length - 1;
}

async function requestByResponses(
  config: AppConfig,
  prompt: string,
): Promise<GenerationResult> {
  const path: OpenAiPath = 'responses';
  const flavors = getOutputFlavors(config, path);
  const failures: string[] = [];

  for (let i = 0; i < flavors.length; i += 1) {
    const flavor = flavors[i];
    try {
      const data = (await postModelJson(config, path, buildResponseApiBody(config, prompt, flavor))) as {
        output_parsed?: unknown;
        output_text?: string;
        output?: unknown[];
      };

      const rawText = extractTextFromResponseApi(data);
      const response = parseWorkspaceResponse(rawText, flavor === 'json_schema' ? data.output_parsed : undefined);
      return {
        response,
        rawText: rawText || JSON.stringify(data.output_parsed ?? response, null, 2),
        endpointLabel: `${connectionModeLabel(config)} · /responses · ${flavorLabel(flavor)}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${flavorLabel(flavor)}：${message}`);
      if (shouldStopAfterFirstFailure(config, flavors, i)) {
        throw decorateError(new Error(failures.join('\n')), `/responses · ${flavorLabel(flavor)}`, config);
      }
    }
  }

  throw decorateError(new Error(failures.join('\n') || '请求失败'), '/responses', config);
}

async function requestByChatCompletions(
  config: AppConfig,
  prompt: string,
): Promise<GenerationResult> {
  const path: OpenAiPath = 'chat/completions';
  const flavors = getOutputFlavors(config, path);
  const failures: string[] = [];

  for (let i = 0; i < flavors.length; i += 1) {
    const flavor = flavors[i];
    try {
      const data = await postModelJson(config, path, buildChatCompletionsBody(config, prompt, flavor), {
        streamUpstream: config.connectionMode !== 'direct' && flavor === 'plain_json',
      });
      const rawText = extractTextFromChatCompletions(data);
      const response = parseWorkspaceResponse(rawText);
      return {
        response,
        rawText: rawText || JSON.stringify(response, null, 2),
        endpointLabel: `${connectionModeLabel(config)} · /chat/completions · ${flavorLabel(flavor)}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${flavorLabel(flavor)}：${message}`);
      if (shouldStopAfterFirstFailure(config, flavors, i)) {
        throw decorateError(new Error(failures.join('\n')), `/chat/completions · ${flavorLabel(flavor)}`, config);
      }
    }
  }

  throw decorateError(new Error(failures.join('\n') || '请求失败'), '/chat/completions', config);
}

export async function testModelConnection(config: AppConfig): Promise<ConnectionTestResult> {
  const path: OpenAiPath = config.apiMode === 'responses' ? 'responses' : 'chat/completions';

  try {
    const data = await postModelJson(
      config,
      path,
      path === 'responses'
        ? {
            model: config.model,
            input: [
              { role: 'system', content: '你是接口连通性测试器，只返回 OK。' },
              { role: 'user', content: '请只返回 OK 两个字。' },
            ],
            max_output_tokens: 16,
          }
        : {
            model: config.model,
            messages: [
              { role: 'system', content: '你是接口连通性测试器，只返回 OK。' },
              { role: 'user', content: '请只返回 OK 两个字。' },
            ],
            max_tokens: 16,
          },
    );

    const rawText = path === 'responses' ? extractTextFromResponseApi(data) : extractTextFromChatCompletions(data);
    if (!rawText.trim()) {
      throw new Error('连接测试有 HTTP 响应，但模型内容为空。请检查模型名，或尝试切换 chat/completions 与 responses。');
    }

    return {
      ok: true,
      message: `连接测试成功，模型返回：${rawText.trim().slice(0, 80)}`,
      endpointLabel: `${connectionModeLabel(config)} · /${path} · connection test`,
      rawText,
    };
  } catch (error) {
    throw decorateError(error, `/${path} · connection test`, config);
  }
}

export async function generateBlueprintPlan({
  config,
  userPrompt,
  currentPlan,
  history,
  library,
}: GenerateArgs): Promise<GenerationResult> {
  const prompt = buildGenerationPrompt({
    config,
    userPrompt,
    currentPlan,
    history,
    library,
  });

  if (config.apiMode === 'responses') {
    return requestByResponses(config, prompt);
  }

  return requestByChatCompletions(config, prompt);
}
