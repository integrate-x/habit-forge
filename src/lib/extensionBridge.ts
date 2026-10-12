import type { CompletionEvent, Habit } from '../../shared/types';
import { getHabitStreak, isCompletedOn, localDateKey } from './completions.ts';
import { defaultSettings } from './settings.ts';
import type { Settings } from './settings.ts';

export const EXTENSION_SNAPSHOT_KEY = 'habit-forge-extension-snapshot';
export const EXTENSION_STATE_EVENT = 'habit-forge:state';

export interface ExtensionHabitSnapshot {
  id: string;
  name: string;
  website: string;
  scheduledTime: string;
  activeDays: number[];
  mandatory: boolean;
  paused: boolean;
  verificationMethod: Habit['verificationMethod'];
  completedToday: boolean;
  currentStreak: number;
  longestStreak: number;
}

export interface ExtensionCompletionSnapshot {
  habitId: string;
  completedAt: string;
  localDate: string;
  source: CompletionEvent['source'];
}

export interface ExtensionStateSnapshot {
  version: 1;
  exportedAt: string;
  today: string;
  localTime: string;
  habits: ExtensionHabitSnapshot[];
  completions: ExtensionCompletionSnapshot[];
  settings: Settings;
}

/** Minimal, non-sensitive app state that the companion extension can consume. */
export function createExtensionSnapshot(
  habits: Habit[],
  events: CompletionEvent[],
  now = new Date(),
  settings: Settings = defaultSettings(),
): ExtensionStateSnapshot {
  const today = localDateKey(now);

  return {
    version: 1,
    exportedAt: now.toISOString(),
    today,
    localTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    settings: {
      ...settings,
      graceDays: settings.graceDays.filter(day => day.localDate === today)
        .map(day => ({ habitId: day.habitId, localDate: day.localDate })),
    },
    habits: habits.map((habit) => {
      const streak = getHabitStreak(habit, events, now, settings.graceDays.filter(day => day.habitId === habit.id).map(day => day.localDate));

      return {
        id: habit.id,
        name: habit.name,
        website: habit.website,
        scheduledTime: habit.scheduledTime,
        activeDays: [...habit.activeDays],
        mandatory: habit.mandatory,
        paused: habit.paused,
        verificationMethod: habit.verificationMethod,
        completedToday: isCompletedOn(events, habit.id, today),
        currentStreak: streak.current,
        longestStreak: streak.longest,
      };
    }),
    completions: events.filter(event => event.localDate === today).map((event) => ({
      habitId: event.habitId,
      completedAt: event.completedAt,
      localDate: event.localDate,
      source: event.source,
    })),
  };
}

export function publishExtensionSnapshot(
  habits: Habit[],
  events: CompletionEvent[],
  settings: Settings = defaultSettings(),
): void {
  const snapshot = createExtensionSnapshot(habits, events, new Date(), settings);
  const serialized = JSON.stringify(snapshot);

  localStorage.setItem(EXTENSION_SNAPSHOT_KEY, serialized);
  window.dispatchEvent(new CustomEvent(EXTENSION_STATE_EVENT, { detail: serialized }));
}

