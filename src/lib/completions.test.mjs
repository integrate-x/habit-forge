import assert from 'node:assert/strict';
import test from 'node:test';

const { getHabitStreak, isCompletedOn, localDateKey, recordCompletion } = await import('./completions.ts');
const { migrateHabitArray } = await import('./migrateHabits.ts');

const { createExtensionSnapshot } = await import('./extensionBridge.ts');

const habit = { id: 'h1', activeDays: [1, 2, 3, 4, 5] };
const event = (localDate) => ({ id: localDate, habitId: 'h1', localDate, completedAt: `${localDate}T12:00:00.000Z`, source: 'manual' });

test('localDateKey uses local calendar fields', () => {
  assert.equal(localDateKey(new Date(2026, 9, 12, 23, 30)), '2026-10-12');
});

test('records one event per habit and local day', () => {
  const first = recordCompletion([], 'h1', new Date(2026, 9, 12, 8));
  const duplicate = recordCompletion(first, 'h1', new Date(2026, 9, 12, 20));
  assert.equal(first.length, 1);
  assert.equal(duplicate.length, 1);
  assert.equal(isCompletedOn(duplicate, 'h1', '2026-10-12'), true);
});

test('streaks skip inactive weekdays and ignore missed scheduled days', () => {
  const events = ['2026-10-08', '2026-10-09', '2026-10-12'].map(event);
  assert.deepEqual(getHabitStreak(habit, events, new Date(2026, 9, 12, 14)), { current: 3, longest: 3 });
  assert.deepEqual(getHabitStreak(habit, [event('2026-10-08')], new Date(2026, 9, 12, 14)), { current: 0, longest: 1 });
});

test('an incomplete scheduled day remains in progress until tomorrow', () => {
  const events = ['2026-10-08', '2026-10-09'].map(event);
  assert.deepEqual(getHabitStreak(habit, events, new Date(2026, 9, 12, 14)), { current: 2, longest: 2 });
});

test('streak is zero when no weekdays are scheduled', () => {
  assert.deepEqual(getHabitStreak({ id: 'h1', activeDays: [] }, [event('2026-10-12')], new Date(2026, 9, 12)), { current: 0, longest: 0 });
});

test('migration preserves valid current records in a mixed array', () => {
  const current = { id: 'current', name: 'Read', description: '', category: 'learning', minimumRequirement: 1, website: '', scheduledTime: '20:00', activeDays: [1], mandatory: true, verificationMethod: 'manual', paused: false, createdAt: 'now', updatedAt: 'now' };
  const legacy = { name: 'Walk', time: '07:00' };
  const result = migrateHabitArray([current, legacy], (value) => value?.id === 'current', (value) => ({ ...current, id: 'migrated', name: value.name }));
  assert.equal(result.status, 'migrated');
  assert.deepEqual(result.habits.map((item) => item.id), ['current', 'migrated']);
});

test('migration refuses unknown records instead of silently dropping them', () => {
  const result = migrateHabitArray([{ name: 'Modern but incomplete' }], () => false, () => null);
  assert.equal(result.status, 'unsafe');
});


test('extension snapshot exposes minimal synchronized habit state', () => {
  const habitRecord = {
    id: 'h1',
    name: 'Read',
    description: 'Private notes stay in the app',
    category: 'learning',
    minimumRequirement: 1,
    website: 'https://example.com',
    scheduledTime: '20:00',
    activeDays: [1],
    mandatory: true,
    verificationMethod: 'manual',
    paused: false,
    createdAt: 'now',
    updatedAt: 'now',
  };
  const snapshot = createExtensionSnapshot([habitRecord], [event('2026-10-12')], new Date(2026, 9, 12, 10));

  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.today, '2026-10-12');
  assert.equal(snapshot.habits[0].completedToday, true);
  assert.equal(snapshot.habits[0].currentStreak, 1);
  assert.equal('description' in snapshot.habits[0], false);
});
