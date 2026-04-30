export interface JsonParseFromTextOptions {
  emptyMessage?: string;
  sourceLabel?: string;
}

type JsonCandidate = {
  text: string;
  start: number;
  end: number;
  source: 'direct' | 'fenced' | 'balanced';
};

function previewText(value: string, maxLength = 220): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength)}...`;
}

function getFencedCandidates(text: string): JsonCandidate[] {
  const candidates: JsonCandidate[] = [];
  const fencePattern = /```(?:json|JSON)?\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(text)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    const start = match.index + match[0].indexOf(match[1]);
    candidates.push({
      text: raw,
      start,
      end: start + raw.length,
      source: 'fenced',
    });
  }

  return candidates;
}

function readBalancedJson(text: string, start: number): JsonCandidate | null {
  const first = text[start];
  const expectedFirstClose = first === '{' ? '}' : first === '[' ? ']' : '';
  if (!expectedFirstClose) return null;

  const stack = [expectedFirstClose];
  let inString = false;
  let escaping = false;

  for (let index = start + 1; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === '\\') {
        escaping = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      stack.push('}');
      continue;
    }

    if (char === '[') {
      stack.push(']');
      continue;
    }

    if (char === '}' || char === ']') {
      const expected = stack.pop();
      if (char !== expected) return null;
      if (stack.length === 0) {
        return {
          text: text.slice(start, index + 1).trim(),
          start,
          end: index + 1,
          source: 'balanced',
        };
      }
    }
  }

  return null;
}

function getBalancedCandidates(text: string): JsonCandidate[] {
  const candidates: JsonCandidate[] = [];
  const maxStarts = 160;
  let starts = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char !== '{' && char !== '[') continue;
    starts += 1;
    if (starts > maxStarts) break;

    const candidate = readBalancedJson(text, index);
    if (!candidate) continue;
    candidates.push(candidate);
  }

  return candidates;
}

function scoreParsedJson(value: unknown): number {
  if (!value || typeof value !== 'object') return 1;

  const candidate = value as {
    responseType?: unknown;
    operations?: unknown;
    meta?: unknown;
    nodes?: unknown;
    links?: unknown;
    plan?: unknown;
  };

  let score = 10;
  if (candidate.responseType === 'blueprint_workspace_operation') score += 120;
  if (Array.isArray(candidate.operations)) score += 80;
  if (candidate.meta && Array.isArray(candidate.nodes) && Array.isArray(candidate.links)) score += 90;
  if (candidate.plan && typeof candidate.plan === 'object') score += 40;
  return score;
}

function parseMaybeNestedJson(candidateText: string): { value: unknown; text: string } | null {
  try {
    const value = JSON.parse(candidateText);
    if (typeof value === 'string') {
      const nested = parseJsonFromText(value, { emptyMessage: '嵌套 JSON 字符串为空。' });
      return { value: nested, text: value };
    }
    return { value, text: candidateText };
  } catch {
    return null;
  }
}

function candidateKey(candidate: JsonCandidate): string {
  return `${candidate.start}:${candidate.end}:${candidate.text.length}`;
}

export function extractJsonStringFromText(text: string, options: JsonParseFromTextOptions = {}): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(options.emptyMessage || '内容为空。');
  }

  const candidates: JsonCandidate[] = [];
  candidates.push({ text: trimmed, start: 0, end: trimmed.length, source: 'direct' });
  candidates.push(...getFencedCandidates(trimmed));
  candidates.push(...getBalancedCandidates(trimmed));

  const uniqueCandidates = candidates.filter((candidate, index, list) => {
    const key = candidateKey(candidate);
    return list.findIndex((item) => candidateKey(item) === key || item.text === candidate.text) === index;
  });

  let best: { candidate: JsonCandidate; score: number; value: unknown; text: string } | null = null;

  for (const candidate of uniqueCandidates) {
    const parsed = parseMaybeNestedJson(candidate.text);
    if (!parsed) continue;
    const score = scoreParsedJson(parsed.value);
    if (!best || score > best.score || (score === best.score && candidate.source === 'direct')) {
      best = { candidate, score, value: parsed.value, text: parsed.text };
    }
  }

  if (best) {
    return best.text;
  }

  const source = options.sourceLabel ? `${options.sourceLabel}中` : '';
  throw new Error(
    `无法从${source}提取合法 JSON。模型可能输出了多段文本、重复 JSON，或 JSON 被截断。返回预览：${previewText(trimmed)}`,
  );
}

export function parseJsonFromText<T = unknown>(text: string, options: JsonParseFromTextOptions = {}): T {
  const jsonText = extractJsonStringFromText(text, options);
  try {
    return JSON.parse(jsonText) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`JSON 解析失败：${message}。内容预览：${previewText(jsonText)}`);
  }
}
