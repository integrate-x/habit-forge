import type {
  Habit,
  HabitCategory,
  VerificationMethod,
} from '../../shared/types';
import { backupHabitDataBeforeMigration } from './completionStorage';
import { migrateHabitArray } from './migrateHabits';

const STORAGE_KEY = 'habit-forge';
const INITIALIZED_KEY = 'habit-forge-initialized';

interface LegacyHabit {
  id?: number | string;
  name?: string;
  time?: string;
  site?: string;
  days?: number[];
  done?: boolean;
}

function createDefaultHabits(): Habit[] {
  const now = new Date().toISOString();

  return [
    {
      id: 'leetcode-default',
      name: 'LeetCode',
      description: 'Solve at least one LeetCode problem.',
      category: 'coding',
      minimumRequirement: 1,
      website: 'https://leetcode.com',
      scheduledTime: '21:00',
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      mandatory: true,
      verificationMethod: 'leetcode',
      paused: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'github-default',
      name: 'GitHub',
      description: 'Make at least one meaningful contribution.',
      category: 'coding',
      minimumRequirement: 1,
      website: 'https://github.com',
      scheduledTime: '18:00',
      activeDays: [0, 1, 2, 3, 4],
      mandatory: true,
      verificationMethod: 'github',
      paused: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function isValidCategory(
  value: unknown,
): value is HabitCategory {
  return (
    value === 'coding' ||
    value === 'learning' ||
    value === 'fitness' ||
    value === 'personal' ||
    value === 'other'
  );
}

function isValidVerificationMethod(
  value: unknown,
): value is VerificationMethod {
  return (
    value === 'manual' ||
    value === 'github' ||
    value === 'leetcode' ||
    value === 'kaggle'
  );
}

function isHabit(value: unknown): value is Habit {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const habit = value as Partial<Habit>;

  return (
    typeof habit.id === 'string' &&
    typeof habit.name === 'string' &&
    typeof habit.description === 'string' &&
    isValidCategory(habit.category) &&
    typeof habit.minimumRequirement === 'number' &&
    habit.minimumRequirement >= 1 &&
    typeof habit.website === 'string' &&
    typeof habit.scheduledTime === 'string' &&
    Array.isArray(habit.activeDays) &&
    habit.activeDays.every(
      (day) =>
        Number.isInteger(day) &&
        day >= 0 &&
        day <= 6,
    ) &&
    typeof habit.mandatory === 'boolean' &&
    isValidVerificationMethod(
      habit.verificationMethod,
    ) &&
    typeof habit.paused === 'boolean' &&
    (habit.verificationUsername === undefined || typeof habit.verificationUsername === 'string') &&
    typeof habit.createdAt === 'string' &&
    typeof habit.updatedAt === 'string'
  );
}

function migrateLegacyHabit(
  legacy: Record<string, unknown>,
  index: number,
): Habit | null {
  const rawName = legacy.name;

  if (typeof rawName !== 'string' || !rawName.trim()) {
    return null;
  }

  const now = new Date().toISOString();
  const name = rawName.trim();
  const lowerName = name.toLowerCase();

  let category: HabitCategory = 'other';
  let verificationMethod: VerificationMethod = 'manual';

  if (lowerName.includes('leetcode')) {
    category = 'coding';
    verificationMethod = 'leetcode';
  } else if (lowerName.includes('github')) {
    category = 'coding';
    verificationMethod = 'github';
  } else if (lowerName.includes('kaggle')) {
    category = 'learning';
    verificationMethod = 'kaggle';
  }

  const legacyHabit = legacy as LegacyHabit;

  return {
    id: `migrated-${legacyHabit.id ?? index}-${Date.now()}`,
    name,
    description: '',
    category,
    minimumRequirement: 1,
    website: typeof legacyHabit.site === 'string' ? legacyHabit.site : '',
    scheduledTime: typeof legacyHabit.time === 'string' ? legacyHabit.time : '21:00',
    activeDays:
      Array.isArray(legacyHabit.days) &&
      legacyHabit.days.length > 0 &&
      legacyHabit.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        ? legacyHabit.days
        : [0, 1, 2, 3, 4, 5, 6],
    mandatory: true,
    verificationMethod,
    paused: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function loadHabits(): Habit[] {
  const initialized = localStorage.getItem(INITIALIZED_KEY);
  const saved = localStorage.getItem(STORAGE_KEY);

  try {
    // First-ever launch.
    if (!initialized && !saved) {
      const defaults = createDefaultHabits();

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(defaults),
      );

      localStorage.setItem(
        INITIALIZED_KEY,
        'true',
      );

      return defaults;
    }

    // Existing user with saved data.
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      const migration = migrateHabitArray(parsed, isHabit, migrateLegacyHabit);

      if (migration.status === 'current') {
        localStorage.setItem(
          INITIALIZED_KEY,
          'true',
        );

        return migration.habits;
      }

      if (migration.status === 'migrated') {
        backupHabitDataBeforeMigration(saved);

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(migration.habits),
        );

        localStorage.setItem(
          INITIALIZED_KEY,
          'true',
        );

        return migration.habits;
      }

      backupHabitDataBeforeMigration(saved);
    }

    // User has initialized the app but currently
    // has zero habits, or saved data was unsafe.
    return [];
  } catch {
    if (saved) {
      backupHabitDataBeforeMigration(saved);
    }

    return [];
  }
}

export function saveHabits(
  habits: Habit[],
): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(habits),
  );

  localStorage.setItem(
    INITIALIZED_KEY,
    'true',
  );
}

