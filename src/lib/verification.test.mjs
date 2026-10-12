import test from 'node:test';
import assert from 'node:assert/strict';
import { countGitHubActivities, verifyGitHub } from './verification.ts';

const now = new Date(2026, 9, 12, 12);
const activity = (id, type = 'PushEvent') => ({ id, type, created_at: now.toISOString(), payload: { action: 'opened' } });
test('GitHub verification counts unique qualifying public activity on the local day', () => {
  assert.equal(countGitHubActivities([activity('1'), activity('1'), activity('2', 'PullRequestEvent'),
    activity('3', 'WatchEvent'), { ...activity('4'), created_at: 'invalid' }], '2026-10-12'), 2);
});
test('verification paginates and deduplicates provider event IDs', async () => {
  let calls = 0;
  const fetcher = async () => ({ ok: true, json: async () => ++calls === 1
    ? Array.from({ length: 100 }, (_, i) => activity(String(i))) : [activity('1'), activity('101')] });
  assert.equal(await verifyGitHub('octocat', 100, now, fetcher), 101);
  assert.equal(calls, 2);
});
test('verification fails closed for rate limits, insufficient activity and invalid responses', async () => {
  await assert.rejects(verifyGitHub('octocat', 1, now, async () => ({ ok: false, status: 403 })), /rate limit/);
  await assert.rejects(verifyGitHub('octocat', 1, now, async () => ({ ok: true, json: async () => [] })), /0\/1/);
  await assert.rejects(verifyGitHub('octocat', 1, now, async () => ({ ok: true, json: async () => ({}) })), /unexpected/);
  await assert.rejects(verifyGitHub('../bad', 1, now), /username/);
});
