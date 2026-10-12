import type { CompletionEvent } from '../../shared/types';

const EVENTS_KEY = 'habit-forge-completions';
const EVENTS_BACKUP_KEY = 'habit-forge-completions-recovery';

function isCompletionEvent(value: unknown): value is CompletionEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<CompletionEvent>;
  return typeof event.id === 'string' && event.id.length > 0 &&
    typeof event.habitId === 'string' && event.habitId.length > 0 &&
    typeof event.completedAt === 'string' && !Number.isNaN(Date.parse(event.completedAt)) &&
    typeof event.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.localDate) &&
    ['manual', 'github', 'leetcode', 'kaggle'].includes(event.source!) &&
    (event.verification === undefined || (event.verification &&
      Number.isInteger(event.verification.count) && event.verification.count > 0 &&
      typeof event.verification.unit === 'string' &&
      typeof event.verification.checkedAt === 'string' && Number.isFinite(Date.parse(event.verification.checkedAt))));
}

export function loadCompletionEvents(): CompletionEvent[] {
  const raw = localStorage.getItem(EVENTS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isCompletionEvent)) {
      // Keep the original unmodified so malformed or future-version data is recoverable.
      if (!localStorage.getItem(EVENTS_BACKUP_KEY)) localStorage.setItem(EVENTS_BACKUP_KEY, raw);
      return [];
    }
    return parsed;
  } catch {
    if (!localStorage.getItem(EVENTS_BACKUP_KEY)) localStorage.setItem(EVENTS_BACKUP_KEY, raw);
    return [];
  }
}

export function saveCompletionEvents(events: CompletionEvent[]): void {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

/** Preserve original habit JSON before replacing it with migrated data. */
export function backupHabitDataBeforeMigration(raw: string): void {
  const key = 'habit-forge-recovery';
  if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
}

