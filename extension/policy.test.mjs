import test from 'node:test';
import assert from 'node:assert/strict';
import { blockingRules, dueHabits, isSnapshot, safeWebsite } from './policy.js';
import { defaultSettings } from '../src/lib/settings.ts';

const now = new Date(2026, 9, 12, 21);
function snapshot() {
  return { version: 1, exportedAt: now.toISOString(), settings: { ...defaultSettings(), blockedSites: ['youtube.com'], blockingEnabled: true },
    habits: [{ id: 'h1', name: 'Code', mandatory: true, paused: false, activeDays: [1], scheduledTime: '20:00', website: 'https://github.com' }],
    completions: [] };
}
test('blocking is opt-in and only starts when mandatory habits are due', () => {
  const state = snapshot();
  assert.equal(blockingRules(state, new Date(2026, 9, 12, 19)).length, 0);
  assert.equal(blockingRules(state, now).length, 1);
  state.settings.blockingEnabled = false;
  assert.equal(blockingRules(state, now).length, 0);
});
test('rules match domains, preserve habit sites, and only block navigation', () => {
  const state = snapshot();
  const rule = blockingRules(state, now)[0];
  assert.deepEqual(rule.condition.requestDomains, ['youtube.com']);
  assert.ok(rule.condition.excludedRequestDomains.includes('github.com'));
  assert.deepEqual(rule.condition.resourceTypes, ['main_frame']);
});
test('completed, paused, off-day and optional habits do not enforce blocking', () => {
  const state = snapshot();
  state.completions.push({ habitId: 'h1', localDate: '2026-10-12' });
  assert.deepEqual(dueHabits(state, now), []);
  state.completions = [];
  state.habits[0].paused = true;
  assert.deepEqual(dueHabits(state, now), []);
  state.habits[0].paused = false;
  assert.deepEqual(dueHabits(state, new Date(2026, 9, 13, 21)), []);
  state.habits[0].mandatory = false;
  assert.equal(blockingRules(state, now).length, 0);
});
test('completion status is recalculated after midnight, not cached completedToday', () => {
  const state = snapshot();
  state.habits[0].activeDays = [1, 2];
  state.habits[0].completedToday = true;
  state.completions.push({ habitId: 'h1', localDate: '2026-10-12' });
  assert.equal(dueHabits(state, new Date(2026, 9, 13, 21)).length, 1);
});
test('Exam Mode and Grace Days disable enforcement without creating completions', () => {
  const state = snapshot();
  state.settings.examMode = true;
  assert.deepEqual(dueHabits(state, now), []);
  state.settings.examMode = false;
  state.settings.graceDays = [{ habitId: 'h1', localDate: '2026-10-12' }];
  assert.deepEqual(dueHabits(state, now), []);
  assert.equal(state.completions.length, 0);
});
test('rejects malformed snapshots and unsafe tab URLs', () => {
  assert.equal(isSnapshot(snapshot()), true);
  const state = snapshot();
  state.settings.blockedSites = ['*'];
  assert.equal(isSnapshot(state), false);
  assert.equal(safeWebsite('javascript:alert(1)'), null);
  assert.equal(safeWebsite('https://user:pass@example.com'), null);
  assert.equal(safeWebsite('https://github.com'), 'https://github.com/');
});
