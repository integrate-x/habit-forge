import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCompletionEvents, saveCompletionEvents, backupHabitDataBeforeMigration } from './completionStorage.ts';

function storage(entries = []) {
  const data = new Map(entries);
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  return data;
}
test('existing manual events and new verified events survive storage round trips', () => {
  storage();
  const events = ['manual', 'github'].map((source, index) => ({
    id: String(index), habitId: 'h', completedAt: '2026-10-12T10:00:00Z', localDate: '2026-10-12', source,
  }));
  saveCompletionEvents(events);
  assert.deepEqual(loadCompletionEvents(), events);
});
test('unknown completion sources are backed up before fallback data is saved', () => {
  const raw = JSON.stringify([{ source: 'future-version' }]);
  const data = storage([['habit-forge-completions', raw]]);
  assert.deepEqual(loadCompletionEvents(), []);
  saveCompletionEvents([]);
  assert.equal(data.get('habit-forge-completions-recovery'), raw);
});
test('malformed JSON is recoverable and migration does not replace the first backup', () => {
  const data = storage([['habit-forge-completions', 'broken-json']]);
  assert.deepEqual(loadCompletionEvents(), []);
  assert.equal(data.get('habit-forge-completions-recovery'), 'broken-json');
  backupHabitDataBeforeMigration('original');
  backupHabitDataBeforeMigration('later');
  assert.equal(data.get('habit-forge-recovery'), 'original');
});
