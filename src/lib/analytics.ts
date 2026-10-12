import type { Habit, CompletionEvent } from '../../shared/types';
import { isCompletedOn, localDateKey } from './completions.ts';
import type { Settings } from './settings';

export function getAnalytics(habits: Habit[], events: CompletionEvent[], settings: Settings, now = new Date(), days = 30) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - index - 1));
    const key = localDateKey(date);
    const scheduled = habits.filter(habit => !habit.paused && localDateKey(new Date(habit.createdAt)) <= key &&
      habit.activeDays.includes(date.getDay()) &&
      !settings.graceDays.some(day => day.habitId === habit.id && day.localDate === key));
    const completed = scheduled.filter(habit => isCompletedOn(events, habit.id, key)).length;
    return { date: key, scheduled: scheduled.length, completed,
      rate: scheduled.length ? Math.round(100 * completed / scheduled.length) : null };
  });
}
