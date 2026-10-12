export type HabitCategory = 'coding' | 'learning' | 'fitness' | 'personal' | 'other';
export type VerificationMethod = 'manual' | 'github' | 'leetcode' | 'kaggle';

export interface Habit {
  id: string;
  name: string;
  description: string;
  category: HabitCategory;
  minimumRequirement: number;
  website: string;
  scheduledTime: string;
  /** JavaScript day indexes: 0 = Sunday, 6 = Saturday. */
  activeDays: number[];
  mandatory: boolean;
  verificationMethod: VerificationMethod;
  paused: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Append-only record of a user's completion action. */
export interface CompletionEvent {
  id: string;
  habitId: string;
  completedAt: string;
  /** Local YYYY-MM-DD captured when the event was created. */
  localDate: string;
  source: 'manual';
}
