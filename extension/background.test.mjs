import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey } from './policy.js';
import { defaultSettings } from '../src/lib/settings.ts';

test('background sync, tick deduplication, completion unlock, and sender validation', async () => {
  const listeners = {};
  const listen = key => ({ addListener: fn => { listeners[key] = fn; } });
  const state = {};
  let rules = [], tabs = 0, notifications = 0;
  globalThis.chrome = {
    runtime: { id: 'extension-id', onInstalled: listen('install'), onStartup: listen('startup'), onMessage: listen('message') },
    alarms: { create: async () => {}, onAlarm: listen('alarm') },
    action: { onClicked: listen('click') },
    storage: { local: {
      get: async () => structuredClone(state),
      set: async data => Object.assign(state, structuredClone(data)),
      remove: async key => { delete state[key]; },
    } },
    declarativeNetRequest: {
      getDynamicRules: async () => rules,
      updateDynamicRules: async data => { rules = data.addRules; },
    },
    tabs: { create: async () => { tabs++; } },
    notifications: { create: async () => { notifications++; } },
  };
  await import('./background.js');
  const now = new Date();
  const payload = {
    version: 1, exportedAt: now.toISOString(),
    settings: { ...defaultSettings(), blockingEnabled: true, autoOpen: true, notifications: true, blockedSites: ['youtube.com'] },
    habits: [{ id: 'h', name: 'Code', website: 'https://github.com', scheduledTime: '00:00', activeDays: [now.getDay()], paused: false, mandatory: true }],
    completions: [],
  };
  const send = (url = 'http://localhost:5173') => new Promise(resolve =>
    listeners.message({ type: 'HABIT_FORGE_STATE', payload }, { id: 'extension-id', url }, resolve));
  assert.equal((await send('https://evil.example')).ok, false);
  assert.equal(tabs, 0);
  assert.equal((await send()).ok, true);
  assert.equal(rules.length, 1);
  assert.equal(tabs, 1);
  assert.equal(notifications, 1);
  assert.equal((await send()).ok, true);
  assert.equal(tabs, 1);
  assert.equal(notifications, 1);
  payload.completions.push({ habitId: 'h', localDate: dateKey(now) });
  assert.equal((await send()).ok, true);
  assert.equal(rules.length, 0);
  payload.completions = [];
  payload.settings.examMode = true;
  assert.equal((await send()).ok, true);
  assert.equal(rules.length, 0);
  delete globalThis.chrome;
});
