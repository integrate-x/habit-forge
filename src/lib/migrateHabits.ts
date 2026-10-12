import type { Habit } from '../../shared/types';

export type HabitMigrationResult =
  | { status: 'current' | 'migrated'; habits: Habit[] }
  | { status: 'unsafe'; reason: string };

/**
 * Convert only records that are clearly legacy shaped. Mixed arrays keep their
 * valid current records; unknown records make the migration fail closed.
 */
export function migrateHabitArray(
  parsed: unknown,
  isHabit: (value: unknown) => value is Habit,
  migrateLegacy: (value: Record<string, unknown>, index: number) => Habit | null,
): HabitMigrationResult {
  if (!Array.isArray(parsed)) return { status: 'unsafe', reason: 'Expected an array' };
  if (parsed.every(isHabit)) return { status: 'current', habits: parsed };

  const habits: Habit[] = [];
  let changed = false;
  for (const [index, item] of parsed.entries()) {
    if (isHabit(item)) {
      habits.push(item);
      continue;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { status: 'unsafe', reason: `Unrecognized record at index ${index}` };
    }
    const legacy = item as Record<string, unknown>;
    const hasLegacyMarker = ['time', 'site', 'days', 'done'].some((key) => key in legacy);
    if (!hasLegacyMarker || typeof legacy.name !== 'string' || !legacy.name.trim()) {
      return { status: 'unsafe', reason: `Unrecognized record at index ${index}` };
    }
    const migrated = migrateLegacy(legacy, index);
    if (!migrated) return { status: 'unsafe', reason: `Could not migrate record at index ${index}` };
    habits.push(migrated);
    changed = true;
  }
  return { status: changed ? 'migrated' : 'current', habits };
}
