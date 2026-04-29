import type { AppConfig, BlueprintLibrary, BlueprintPlan, BlueprintProject } from '../types';

const STORAGE_KEY = 'ue-blueprint-ai-studio:config';
const PLAN_KEY = 'ue-blueprint-ai-studio:plan';
const POSITIONS_KEY = 'ue-blueprint-ai-studio:positions';
const LIBRARY_KEY = 'ue-blueprint-ai-studio:library:v1';

function generateId(prefix: string): string {
  const randomId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${randomId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeProjectName(plan: BlueprintPlan): string {
  return plan.meta.title?.trim() || '未命名蓝图';
}

export function createBlueprintProject(
  plan: BlueprintPlan,
  options: Partial<Pick<BlueprintProject, 'name' | 'userName' | 'folderPath'>> = {},
): BlueprintProject {
  const timestamp = nowIso();
  return {
    id: generateId('bp'),
    name: options.name?.trim() || safeProjectName(plan),
    userName: options.userName?.trim() || '默认用户',
    folderPath: options.folderPath?.trim() || '示例蓝图',
    createdAt: timestamp,
    updatedAt: timestamp,
    plan,
  };
}

function isBlueprintProject(value: unknown): value is BlueprintProject {
  const project = value as Partial<BlueprintProject> | null;
  return Boolean(
    project &&
      typeof project.id === 'string' &&
      typeof project.name === 'string' &&
      typeof project.userName === 'string' &&
      typeof project.folderPath === 'string' &&
      project.plan &&
      typeof project.plan === 'object',
  );
}

export function loadStoredConfig(defaultConfig: AppConfig): AppConfig {
  if (typeof window === 'undefined') {
    return defaultConfig;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultConfig;
    }

    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    const connectionModeCandidate = parsed.connectionMode;
    const apiModeCandidate = parsed.apiMode;
    const connectionMode: AppConfig['connectionMode'] =
      connectionModeCandidate === 'direct' ||
      connectionModeCandidate === 'cloud_proxy' ||
      connectionModeCandidate === 'local_proxy'
        ? connectionModeCandidate
        : defaultConfig.connectionMode;
    const apiMode: AppConfig['apiMode'] =
      apiModeCandidate === 'chat_completions' || apiModeCandidate === 'responses'
        ? apiModeCandidate
        : defaultConfig.apiMode;

    return {
      ...defaultConfig,
      ...parsed,
      connectionMode,
      apiMode,
      localProxyUrl:
        typeof parsed.localProxyUrl === 'string' && parsed.localProxyUrl.trim()
          ? parsed.localProxyUrl
          : defaultConfig.localProxyUrl,
      apiKey:
        parsed.persistApiKey && typeof parsed.apiKey === 'string' ? parsed.apiKey : defaultConfig.apiKey,
    };
  } catch {
    return defaultConfig;
  }
}

export function storeConfig(config: AppConfig): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const payload: AppConfig = {
      ...config,
      apiKey: config.persistApiKey ? config.apiKey : '',
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore localStorage write failure
  }
}

export function loadStoredLibrary(defaultPlan: BlueprintPlan): BlueprintLibrary {
  const fallbackProject = createBlueprintProject(defaultPlan, {
    name: defaultPlan.meta.title || '交互门示例',
    userName: '默认用户',
    folderPath: '示例蓝图',
  });

  if (typeof window === 'undefined') {
    return { version: 1, activeProjectId: fallbackProject.id, projects: [fallbackProject] };
  }

  try {
    const raw = window.localStorage.getItem(LIBRARY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BlueprintLibrary>;
      const projects = Array.isArray(parsed.projects) ? parsed.projects.filter(isBlueprintProject) : [];
      if (projects.length > 0) {
        const activeProjectId =
          typeof parsed.activeProjectId === 'string' && projects.some((item) => item.id === parsed.activeProjectId)
            ? parsed.activeProjectId
            : projects[0].id;
        return { version: 1, activeProjectId, projects };
      }
    }

    const legacyPlan = loadStoredPlan();
    if (legacyPlan && typeof legacyPlan === 'object') {
      const legacyProject = createBlueprintProject(legacyPlan as BlueprintPlan, {
        name: (legacyPlan as BlueprintPlan).meta?.title || '本地旧蓝图',
        userName: '默认用户',
        folderPath: '已迁移',
      });
      return { version: 1, activeProjectId: legacyProject.id, projects: [legacyProject] };
    }
  } catch {
    // fall through to demo project
  }

  return { version: 1, activeProjectId: fallbackProject.id, projects: [fallbackProject] };
}

export function storeLibrary(library: BlueprintLibrary): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  } catch {
    // ignore
  }
}

export function loadStoredPlan(): unknown | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PLAN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storePlan(plan: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  } catch {
    // ignore
  }
}

function positionKey(scope?: string): string {
  return scope ? `${POSITIONS_KEY}:${scope}` : POSITIONS_KEY;
}

export function loadStoredPositions(scope?: string): Record<string, { x: number; y: number }> | null {
  if (typeof window === 'undefined') return null;
  try {
    const scopedRaw = window.localStorage.getItem(positionKey(scope));
    if (scopedRaw) return JSON.parse(scopedRaw);

    const legacyRaw = scope ? window.localStorage.getItem(POSITIONS_KEY) : null;
    return legacyRaw ? JSON.parse(legacyRaw) : null;
  } catch {
    return null;
  }
}

export function storePositions(positions: Record<string, { x: number; y: number }>, scope?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(positionKey(scope), JSON.stringify(positions));
  } catch {
    // ignore
  }
}
