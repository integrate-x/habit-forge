import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, isSettings, loadSettings, normalizeDomain, saveSettings } from './settings.ts';
import { getHabitStreak } from './completions.ts';
import { getAnalytics } from './analytics.ts';

test('normalizes domains and rejects unsafe schemes and local app addresses', () => {
  assert.equal(normalizeDomain('https://www.YouTube.com/watch?v=1'), 'youtube.com');
  for (const value of ['javascript:alert(1)', '*', 'localhost', '127.0.0.1', 'https://user:pass@example.com']) {
    assert.equal(normalizeDomain(value), null);
  }
});
test('settings have safe defaults and validate schema versions', () => {
  assert.equal(defaultSettings().blockingEnabled, false);
  assert.equal(isSettings(defaultSettings()), true);
  assert.equal(isSettings({ ...defaultSettings(), version: 2 }), false);
  assert.equal(isSettings({ ...defaultSettings(), autoOpen: 'yes' }), false);
});
test('settings preserve future or malformed data in a recovery key', () => {
  const data = new Map([['habit-forge-settings', '{"version":2}']]);
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  assert.deepEqual(loadSettings(), defaultSettings());
  saveSettings(defaultSettings());
  assert.equal(data.get('habit-forge-settings-recovery'), '{"version":2}');
  assert.deepEqual(loadSettings(), defaultSettings());
});
test('Grace Days bridge streak gaps without awarding completion credit', () => {
  const habit = { id: 'h', activeDays: [0, 1, 2, 3, 4, 5, 6] };
  const events = ['2026-10-10', '2026-10-12'].map(localDate => ({ habitId: 'h', localDate }));
  assert.deepEqual(getHabitStreak(habit, events, new Date(2026, 9, 12), ['2026-10-11']), { current: 2, longest: 2 });
  assert.deepEqual(getHabitStreak(habit, events, new Date(2026, 9, 12)), { current: 1, longest: 1 });
});
test('analytics deduplicate completions and exclude off-days, deleted habits and grace', () => {
  const habit = { id: 'h', paused: false, activeDays: [1], createdAt: new Date(2026, 9, 1).toISOString() };
  const events = [{ habitId: 'h', localDate: '2026-10-12' }, { habitId: 'h', localDate: '2026-10-12' }, { habitId: 'deleted', localDate: '2026-10-12' }];
  const settings = defaultSettings();
  assert.deepEqual(getAnalytics([habit], events, settings, new Date(2026, 9, 12), 1)[0], { date: '2026-10-12', scheduled: 1, completed: 1, rate: 100 });
  settings.graceDays = [{ habitId: 'h', localDate: '2026-10-12' }];
  assert.equal(getAnalytics([habit], events, settings, new Date(2026, 9, 12), 1)[0].scheduled, 0);
});
