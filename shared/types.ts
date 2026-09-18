export type HabitCategory =
  | 'coding'
  | 'learning'
  | 'fitness'
  | 'personal'
  | 'other';

export type VerificationMethod =
  | 'manual'
  | 'github'
  | 'leetcode'
  | 'kaggle';

export interface Habit {
  id: string;

  name: string;
  description: string;

  category: HabitCategory;

  /**
   * Minimum amount required for the habit to count as complete.
   * Example:
   * LeetCode → 1 problem
   * GitHub → 1 contribution
   */
  minimumRequirement: number;

  /** Optional website associated with this habit. */
  website: string;

  /** Scheduled time in 24-hour HH:mm format. */
  scheduledTime: string;

  /** JavaScript day indexes: 0 = Sunday, 6 = Saturday. */
  activeDays: number[];

  /** Whether this habit must be completed. */
  mandatory: boolean;

  /** How completion is verified. */
  verificationMethod: VerificationMethod;

  /** Whether the habit is currently paused. */
  paused: boolean;

  /** Creation timestamp. */
  createdAt: string;

  /** Last modification timestamp. */
  updatedAt: string;
}