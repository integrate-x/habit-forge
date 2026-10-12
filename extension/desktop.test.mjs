import test from 'node:test';
import assert from 'node:assert/strict';
import { readDesktopSnapshot } from './desktop.js';
import { defaultSettings } from '../src/lib/settings.ts';

test('desktop transport uses a fixed local endpoint and validates token and snapshot', async () => {
  const snapshot = { version:1, exportedAt:new Date().toISOString(), habits:[], completions:[], settings:defaultSettings() };
  const fetcher = async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:5175/snapshot');
    assert.equal(options.headers.Authorization, 'Bearer ' + 'a'.repeat(64));
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify(snapshot));
  };
  assert.deepEqual(await readDesktopSnapshot('a'.repeat(64), fetcher), snapshot);
  await assert.rejects(readDesktopSnapshot('bad', fetcher), /valid desktop/);
  await assert.rejects(readDesktopSnapshot('a'.repeat(64), async () => new Response('', { status:403 })), /not accepted/);
  await assert.rejects(readDesktopSnapshot('a'.repeat(64), async () => new Response('{}')), /invalid snapshot/);
});
