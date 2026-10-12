import type { CompletionEvent, Habit } from '../../shared/types';

/** Local calendar date (YYYY-MM-DD), deliberately independent of UTC. */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDate(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day + amount, 12);
  return localDateKey(date);
}

function weekday(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12).getDay();
}

export function isCompletedOn(
  events: CompletionEvent[],
  habitId: string,
  dateKey: string,
): boolean {
  return events.some((event) => event.habitId === habitId && event.localDate === dateKey);
}

/** Record at most one completion per habit per local calendar day. */
export function recordCompletion(
  events: CompletionEvent[],
  habitId: string,
  completedAt = new Date(),
): CompletionEvent[] {
  const localDate = localDateKey(completedAt);
  if (isCompletedOn(events, habitId, localDate)) return events;
  return [...events, {
    id: globalThis.crypto?.randomUUID?.() ?? `${habitId}-${completedAt.getTime()}`,
    habitId,
    completedAt: completedAt.toISOString(),
    localDate,
    source: 'manual',
  }];
}

export interface HabitStreak {
  current: number;
  longest: number;
}

/** Streaks count completed scheduled days; inactive weekdays are skipped. */
export function getHabitStreak(
  habit: Pick<Habit, 'id' | 'activeDays'>,
  events: CompletionEvent[],
  today = new Date(),
): HabitStreak {
  const activeDays = new Set(habit.activeDays);
  const completed = new Set(
    events.filter((event) => event.habitId === habit.id).map((event) => event.localDate),
  );
  const todayKey = localDateKey(today);

  let current = 0;
  // An unfinished scheduled day is still in progress; begin at the prior day.
  let cursor = todayKey;
  if (activeDays.size > 0) {
    if (activeDays.has(weekday(cursor)) && !completed.has(cursor)) cursor = shiftDate(cursor, -1);
    while (true) {
      if (activeDays.has(weekday(cursor))) {
        if (!completed.has(cursor)) break;
        current += 1;
      }
      cursor = shiftDate(cursor, -1);
    }
  }

  const completedScheduledDays = [...completed]
    .filter((date) => date <= todayKey && activeDays.has(weekday(date)))
    .sort();
  let longest = 0;
  let run = 0;
  let previous: string | undefined;
  for (const date of completedScheduledDays) {
    if (!previous) run = 1;
    else {
      let next = shiftDate(previous, 1);
      while (next < date && !activeDays.has(weekday(next))) next = shiftDate(next, 1);
      run = next === date ? run + 1 : 1;
    }
    longest = Math.max(longest, run);
    previous = date;
  }
  return { current, longest };
}
