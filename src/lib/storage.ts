import type { Habit } from '../../shared/types';

const STORAGE_KEY = 'habit-forge';

const defaultHabits: Habit[] = [
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function loadHabits(): Habit[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return defaultHabits;
    }

    return JSON.parse(saved) as Habit[];
  } catch {
    return defaultHabits;
  }
}

export function saveHabits(habits: Habit[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}