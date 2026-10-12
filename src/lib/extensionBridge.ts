import type { CompletionEvent, Habit } from '../../shared/types';
import { getHabitStreak, isCompletedOn, localDateKey } from './completions.ts';

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
  habits: ExtensionHabitSnapshot[];
  completions: ExtensionCompletionSnapshot[];
}

/** Minimal, non-sensitive app state that the companion extension can consume. */
export function createExtensionSnapshot(
  habits: Habit[],
  events: CompletionEvent[],
  now = new Date(),
): ExtensionStateSnapshot {
  const today = localDateKey(now);

  return {
    version: 1,
    exportedAt: now.toISOString(),
    today,
    habits: habits.map((habit) => {
      const streak = getHabitStreak(habit, events, now);

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
    completions: events.map((event) => ({
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
): void {
  const snapshot = createExtensionSnapshot(habits, events);
  const serialized = JSON.stringify(snapshot);

  localStorage.setItem(EXTENSION_SNAPSHOT_KEY, serialized);
  window.dispatchEvent(new CustomEvent(EXTENSION_STATE_EVENT, { detail: serialized }));
}
