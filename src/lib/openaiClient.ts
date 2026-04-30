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

interface ProxyPayload {
  baseUrl: string;
  apiKey: string;
  path: OpenAiPath;
  body: unknown;
}

const LOCAL_PROXY_FALLBACK_URL = 'http://127.0.0.1:8787';

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

function getProxyEndpoint(config: AppConfig): string {
  if (config.connectionMode === 'cloud_proxy') {
    return '/api/chat-proxy';
  }

  return joinPlainUrl(config.localProxyUrl.trim() || LOCAL_PROXY_FALLBACK_URL, 'proxy/openai');
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message || '网络请求失败。');
  }

  const text = await response.text();
  let parsed: unknown = null;

  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const errorMessage =
      (parsed as { error?: { message?: string } } | null)?.error?.message ??
      (parsed as { message?: string } | null)?.message ??
      text ??
      `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return parsed ?? {};
}

async function postModelJson(config: AppConfig, path: OpenAiPath, body: unknown): Promise<unknown> {
  const apiKey = config.apiKey.trim();

  if (config.connectionMode === 'direct') {
    return fetchJson(joinUrl(config.baseUrl, path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  }

  const payload: ProxyPayload = {
    baseUrl: normalizeOpenAiBaseUrl(config.baseUrl),
    apiKey,
    path,
    body,
  };

  return fetchJson(getProxyEndpoint(config), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
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
    }>;
  };

  const message = payload.choices?.[0]?.message;
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
  if (config.connectionMode === 'direct') {
    return [
      '当前连接方式：浏览器直连。',
      '如果浏览器控制台出现 CORS / preflight / No Access-Control-Allow-Origin，请切换到“云端中转”或“本地代理”。',
      '直连模式要求模型服务商允许网页跨域请求，而且密钥会暴露在浏览器 DevTools 中，只建议个人本地测试。',
    ].join('\n');
  }

  if (config.connectionMode === 'cloud_proxy') {
    return [
      '当前连接方式：云端中转。',
      '请确认接口地址是 OpenAI-compatible 的 /v1 根地址，例如 https://api.example.com/v1。',
      '本站中转函数只转发本次请求，前端代码不会保存密钥；但密钥会经过本站 Serverless。',
    ].join('\n');
  }

  return [
    '当前连接方式：本地代理。',
    '请先下载并运行本地代理，然后确认代理地址是 http://127.0.0.1:8787。',
    '如果仍然失败，请检查本地代理终端日志、模型接口地址、模型名和密钥。',
  ].join('\n');
}

function decorateError(error: unknown, endpointLabel: string, config: AppConfig): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(
    `${message}\n\n请求方式：${connectionModeLabel(config)} · ${endpointLabel}\n可排查：\n1. 接口地址是否写成完整的 /v1 根地址\n2. 模型名是否可用\n3. 该兼容服务是否支持结构化输出\n4. ${getTroubleshootingText(config)}`,
  );
}

async function requestByResponses(
  config: AppConfig,
  prompt: string,
): Promise<GenerationResult> {
  const path: OpenAiPath = 'responses';

  try {
    const data = (await postModelJson(config, path, {
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
    })) as {
      output_parsed?: unknown;
      output_text?: string;
      output?: unknown[];
    };

    const response = parseWorkspaceResponse(extractTextFromResponseApi(data), data.output_parsed);
    return {
      response,
      rawText: JSON.stringify(data.output_parsed ?? response, null, 2),
      endpointLabel: `${connectionModeLabel(config)} · /responses · workspace schema`,
    };
  } catch (error) {
    if (!config.allowJsonFallback) {
      throw decorateError(error, '/responses · workspace schema', config);
    }
  }

  try {
    const fallbackData = await postModelJson(config, path, {
      model: config.model,
      input: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n你当前运行在兼容模式下，必须只返回 JSON 对象。`,
        },
        { role: 'user', content: buildCompatPrompt(prompt) },
      ],
    });

    const rawText = extractTextFromResponseApi(fallbackData);
    const response = parseWorkspaceResponse(rawText);
    return {
      response,
      rawText: rawText || JSON.stringify(response, null, 2),
      endpointLabel: `${connectionModeLabel(config)} · /responses · workspace json fallback`,
    };
  } catch (error) {
    throw decorateError(error, '/responses · workspace json fallback', config);
  }
}

async function requestByChatCompletions(
  config: AppConfig,
  prompt: string,
): Promise<GenerationResult> {
  const path: OpenAiPath = 'chat/completions';

  try {
    const data = await postModelJson(config, path, {
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
    });

    const rawText = extractTextFromChatCompletions(data);
    const response = parseWorkspaceResponse(rawText);
    return {
      response,
      rawText: rawText || JSON.stringify(response, null, 2),
      endpointLabel: `${connectionModeLabel(config)} · /chat/completions · workspace schema`,
    };
  } catch (error) {
    if (!config.allowJsonFallback) {
      throw decorateError(error, '/chat/completions · workspace schema', config);
    }
  }

  try {
    const jsonObjectData = await postModelJson(config, path, {
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n你当前运行在兼容模式下，必须只返回 JSON 对象。`,
        },
        { role: 'user', content: buildCompatPrompt(prompt) },
      ],
      response_format: {
        type: 'json_object',
      },
    });

    const rawText = extractTextFromChatCompletions(jsonObjectData);
    const response = parseWorkspaceResponse(rawText);
    return {
      response,
      rawText: rawText || JSON.stringify(response, null, 2),
      endpointLabel: `${connectionModeLabel(config)} · /chat/completions · workspace json_object fallback`,
    };
  } catch {
    // ignore and try plain fallback
  }

  try {
    const plainData = await postModelJson(config, path, {
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n你当前运行在兼容模式下，必须只返回 JSON 对象。`,
        },
        { role: 'user', content: buildCompatPrompt(prompt) },
      ],
    });

    const rawText = extractTextFromChatCompletions(plainData);
    const response = parseWorkspaceResponse(rawText);
    return {
      response,
      rawText: rawText || JSON.stringify(response, null, 2),
      endpointLabel: `${connectionModeLabel(config)} · /chat/completions · workspace plain-json fallback`,
    };
  } catch (error) {
    throw decorateError(error, '/chat/completions · workspace fallback', config);
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
