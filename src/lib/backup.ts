import type { Habit, CompletionEvent } from '../../shared/types';
import type { Settings } from './settings';
import { isSettings } from './settings.ts';
import { isHabit } from './storage.ts';
import { isCompletionEvent } from './completionStorage.ts';

export interface Backup {
  version: 1;
  exportedAt: string;
  habits: Habit[];
  events: CompletionEvent[];
  settings: Settings;
}
export function createBackup(habits: Habit[], events: CompletionEvent[], settings: Settings): Backup {
  return { version: 1, exportedAt: new Date().toISOString(), habits, events, settings };
}
export function parseBackup(raw: string): Backup {
  if (raw.length > 5_000_000) throw new Error('Backup exceeds the 5 MB limit.');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('Invalid backup JSON.'); }
  const value = parsed as Backup;
  if (!value || value.version !== 1 || !Number.isFinite(Date.parse(value.exportedAt)) ||
    !Array.isArray(value.habits) || !value.habits.every(isHabit) ||
    !Array.isArray(value.events) || !value.events.every(isCompletionEvent) ||
    !isSettings(value.settings)) throw new Error('Unsupported or invalid backup. Existing data was not changed.');
  const habitIds = new Set(value.habits.map(habit => habit.id));
  const eventIds = new Set(value.events.map(event => event.id));
  const days = new Set(value.events.map(event => JSON.stringify([event.habitId, event.localDate])));
  if (habitIds.size !== value.habits.length || eventIds.size !== value.events.length || days.size !== value.events.length ||
    value.habits.some(habit => !habit.id || !habit.name.trim() || !Number.isInteger(habit.minimumRequirement) ||
      !Number.isFinite(Date.parse(habit.createdAt)) || !Number.isFinite(Date.parse(habit.updatedAt)) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(habit.scheduledTime))) throw new Error('Backup contains invalid or duplicate records.');
  return value;
}
export function preserveBeforeRestore(): string {
  const key = `habit-forge-before-restore-${crypto.randomUUID()}`;
  const data = Object.fromEntries(['habit-forge', 'habit-forge-completions', 'habit-forge-settings', 'habit-forge-initialized']
    .map(name => [name, localStorage.getItem(name)]));
  localStorage.setItem(key, JSON.stringify(data));
  return key;
}
export function restoreBackup(backup: Backup): void {
  const key = preserveBeforeRestore();
  const original = JSON.parse(localStorage.getItem(key)!) as Record<string, string | null>;
  try {
    localStorage.setItem('habit-forge', JSON.stringify(backup.habits));
    localStorage.setItem('habit-forge-completions', JSON.stringify(backup.events));
    localStorage.setItem('habit-forge-settings', JSON.stringify(backup.settings));
    localStorage.setItem('habit-forge-initialized', 'true');
  } catch {
    for (const name of Object.keys(original)) localStorage.removeItem(name);
    for (const [name, value] of Object.entries(original)) if (value !== null) localStorage.setItem(name, value);
    throw new Error('Could not restore backup. Original data remains in the recovery copy.');
  }
}
