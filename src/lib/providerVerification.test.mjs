import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyProvider } from './providerVerification.ts';
import { localDateKey } from './completions.ts';

const now = new Date();
function result(overrides = {}) {
  return { provider: 'leetcode', username: 'coder', localDate: localDateKey(now), count: 1, unit: 'distinct accepted problems', ...overrides };
}
test('client sends only verification inputs and validates the returned provider, account, date and threshold', async () => {
  const fetcher = async (url, options) => {
    assert.equal(url, '/api/verify');
    const body = JSON.parse(options.body);
    assert.equal(body.username, 'coder');
    assert.equal(body.localDate, localDateKey(now));
    assert.equal(options.headers['X-Habit-Forge-Verify'], '1');
    assert.ok(body.timeZone);
    return new Response(JSON.stringify(result()));
  };
  assert.equal((await verifyProvider('leetcode', 'coder', 1, now, fetcher)).count, 1);
  for (const overrides of [{ provider: 'kaggle' }, { username: 'other' }, { localDate: '2000-01-01' }, { count: 0 }, { count: 1.5 }]) {
    await assert.rejects(verifyProvider('leetcode', 'coder', 1, now, async () => new Response(JSON.stringify(result(overrides)))), /unexpected/);
  }
});
test('client reports missing service and provider setup errors without credit', async () => {
  await assert.rejects(verifyProvider('leetcode', '../bad', 1, now), /username/);
  await assert.rejects(verifyProvider('leetcode', 'coder', 1, now, async () => { throw new Error('network'); }), /dev:full/);
  await assert.rejects(verifyProvider('kaggle', 'coder', 1, now, async () => new Response('{"error":"Kaggle credentials are not configured."}', { status: 503 })), /not configured/);
});
