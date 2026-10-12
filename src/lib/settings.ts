export interface Settings {
  version: 1;
  blockedSites: string[];
  blockingEnabled: boolean;
  autoOpen: boolean;
  notifications: boolean;
  examMode: boolean;
  graceDays: { habitId: string; localDate: string }[];
}

export function defaultSettings(): Settings {
  return { version: 1, blockedSites: [], blockingEnabled: false, autoOpen: false,
    notifications: false, examMode: false, graceDays: [] };
}

export function normalizeDomain(input: string): string | null {
  try {
    const url = new URL(input.includes('://') ? input.trim() : `https://${input.trim()}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      !host.includes('.') || host === '127.0.0.1' || host.endsWith('.localhost') ||
      !/^[a-z0-9.-]+$/.test(host) || host.split('.').some(part => !part || part.startsWith('-') || part.endsWith('-'))) return null;
    return host;
  } catch { return null; }
}

export function isSettings(value: unknown): value is Settings {
  if (!value || typeof value !== 'object') return false;
  const s = value as Settings;
  return s.version === 1 && ['blockingEnabled', 'autoOpen', 'notifications', 'examMode']
    .every(key => typeof (s as unknown as Record<string, unknown>)[key] === 'boolean') &&
    Array.isArray(s.blockedSites) && s.blockedSites.length <= 100 &&
    s.blockedSites.every(site => typeof site === 'string' && normalizeDomain(site) === site) &&
    Array.isArray(s.graceDays) && s.graceDays.every(day => day && typeof day.habitId === 'string' &&
      typeof day.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.localDate));
}

const KEY = 'habit-forge-settings';
export function loadSettings(): Settings {
  const raw = localStorage.getItem(KEY);
  if (!raw) return defaultSettings();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isSettings(parsed)) return parsed;
  } catch { /* Preserve invalid or future data before using safe defaults. */ }
  if (!localStorage.getItem(`${KEY}-recovery`)) localStorage.setItem(`${KEY}-recovery`, raw);
  return defaultSettings();
}

export function saveSettings(settings: Settings): void {
  if (!isSettings(settings)) throw new Error('Invalid settings');
  localStorage.setItem(KEY, JSON.stringify(settings));
}
