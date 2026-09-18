import type {
  Habit,
  HabitCategory,
  VerificationMethod,
} from '../../shared/types';

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
    typeof habit.createdAt === 'string' &&
    typeof habit.updatedAt === 'string'
  );
}

function migrateLegacyHabit(
  legacy: LegacyHabit,
  index: number,
): Habit | null {
  if (!legacy.name?.trim()) {
    return null;
  }

  const now = new Date().toISOString();
  const name = legacy.name.trim();
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

  return {
    id: `migrated-${legacy.id ?? index}-${Date.now()}`,
    name,
    description: '',
    category,
    minimumRequirement: 1,
    website: legacy.site ?? '',
    scheduledTime: legacy.time ?? '21:00',
    activeDays:
      Array.isArray(legacy.days) &&
      legacy.days.length > 0
        ? legacy.days
        : [0, 1, 2, 3, 4, 5, 6],
    mandatory: true,
    verificationMethod,
    paused: false,
    createdAt: now,
    updatedAt: now,
  };
}

function migrateData(
  parsed: unknown,
): Habit[] | null {
  if (!Array.isArray(parsed)) {
    return null;
  }

  if (parsed.every(isHabit)) {
    return parsed;
  }

  const migrated = parsed
    .map((item, index) =>
      migrateLegacyHabit(
        item as LegacyHabit,
        index,
      ),
    )
    .filter(
      (habit): habit is Habit =>
        habit !== null,
    );

  return migrated.length > 0
    ? migrated
    : [];
}

export function loadHabits(): Habit[] {
  try {
    const initialized =
      localStorage.getItem(INITIALIZED_KEY);

    const saved =
      localStorage.getItem(STORAGE_KEY);

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
      const parsed: unknown =
        JSON.parse(saved);

      const habits = migrateData(parsed);

      if (habits) {
        localStorage.setItem(
          INITIALIZED_KEY,
          'true',
        );

        return habits;
      }
    }

    // User has initialized the app but currently
    // has zero habits.
    return [];
  } catch {
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