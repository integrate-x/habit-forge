import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, parseBackup, restoreBackup } from './backup.ts';
import { defaultSettings } from './settings.ts';

const habit = { id:'h', name:'Read', description:'private', category:'learning', minimumRequirement:1,
  website:'', scheduledTime:'12:00', activeDays:[1], mandatory:true, verificationMethod:'manual', paused:false,
  createdAt:'2026-10-12T12:00:00Z', updatedAt:'2026-10-12T12:00:00Z' };
test('backup round trips and rejects future schema and duplicate records', () => {
  const backup = createBackup([habit], [], defaultSettings());
  assert.deepEqual(parseBackup(JSON.stringify(backup)), backup);
  for (const value of [{ ...backup, version:2 }, { ...backup, habits:[habit, habit] }, { ...backup, habits:[{ ...habit, scheduledTime:'bad' }] }]) {
    assert.throws(() => parseBackup(JSON.stringify(value)));
  }
});
test('restore preserves raw originals and rolls back partial writes when storage fills', () => {
  const data = new Map([['habit-forge', 'original-habits'], ['habit-forge-completions', 'original-events']]);
  let fail = true;
  globalThis.localStorage = {
    getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key),
    setItem: (key, value) => {
      if (key === 'habit-forge-completions' && value === '[]' && fail) throw new Error('Quota');
      data.set(key, value);
    },
  };
  const backup = createBackup([habit], [], defaultSettings());
  assert.throws(() => restoreBackup(backup));
  assert.equal(data.get('habit-forge'), 'original-habits');
  assert.equal(data.get('habit-forge-completions'), 'original-events');
  assert.ok([...data.keys()].some(key => key.startsWith('habit-forge-before-restore-')));
  fail = false;
  restoreBackup(backup);
  assert.equal(JSON.parse(data.get('habit-forge'))[0].id, 'h');
});
