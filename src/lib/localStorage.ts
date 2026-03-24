import type { AppConfig } from '../types';

const STORAGE_KEY = 'ue-blueprint-ai-studio:config';

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
    return {
      ...defaultConfig,
      ...parsed,
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

const PLAN_KEY = 'ue-blueprint-ai-studio:plan';

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
