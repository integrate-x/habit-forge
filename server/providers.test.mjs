import test from 'node:test';
import assert from 'node:assert/strict';
import { countKaggleNotebooks, countLeetCodeProblems, dateInZone, validateRequest, verifyActivity } from './providers.ts';

const now = new Date('2026-10-12T18:45:00Z');
const request = { provider: 'leetcode', username: 'coder', minimum: 1, timeZone: 'Asia/Kolkata', localDate: '2026-10-13' };
const submission = (id, titleSlug = 'two-sum', at = now) => ({ id, titleSlug, timestamp: String(at.getTime() / 1000) });
const leetcode = submissions => ({ data: { matchedUser: { username: 'coder' }, recentAcSubmissionList: submissions } });
const response = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const notebook = (ref = 'coder/read', at = now) => ({ ref, lastRunTime: at.toISOString() });

test('request validation uses the browser timezone and rejects arbitrary providers and stale dates', () => {
  assert.equal(dateInZone(now, 'Asia/Kolkata'), '2026-10-13');
  assert.deepEqual(validateRequest(request, now), request);
  for (const invalid of [{ ...request, provider: 'https://evil.test' }, { ...request, username: '../bad' },
    { ...request, minimum: 1.5 }, { ...request, minimum: 101 }, { ...request, timeZone: 'invalid' },
    { ...request, localDate: '2026-10-12' }]) assert.throws(() => validateRequest(invalid, now));
});
test('LeetCode counts distinct accepted problems, not repeated submissions, using local dates', () => {
  const data = leetcode([submission('1'), submission('2'), submission('3', 'reverse-string'),
    submission('4', 'old', new Date('2026-10-12T18:20:00Z')),
    submission('5', 'future', new Date('2026-10-12T18:46:00Z'))]);
  assert.equal(countLeetCodeProblems(data, request, now), 2);
});
test('LeetCode fails closed for GraphQL errors, unknown accounts and schema changes', () => {
  for (const data of [{ errors: [{ message: 'bad query' }] }, { data: { matchedUser: null } },
    leetcode([{ id: '1', titleSlug: 'x', timestamp: 'broken' }]), { data: { matchedUser: { username: 'other' }, recentAcSubmissionList: [] } }]) {
    assert.throws(() => countLeetCodeProblems(data, request, now));
  }
});
test('Kaggle counts distinct owned notebooks run today and excludes foreign, future and old records', () => {
  const data = [notebook(), notebook(), notebook('CODER/second'), notebook('other/work'),
    notebook('coder/old', new Date('2026-10-12T18:20:00Z')),
    notebook('coder/future', new Date('2026-10-12T18:46:00Z')), { ref: 'coder/unrun', lastRunTime: null }];
  assert.equal(countKaggleNotebooks(data, request, now), 2);
  assert.throws(() => countKaggleNotebooks([{ ref: 'coder/x', lastRunTime: '2026-10-13T00:15:00' }], request, now), /unsupported/);
});
test('LeetCode transport uses a fixed endpoint without credentials and enforces minimum activity', async () => {
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://leetcode.com/graphql/');
    assert.equal(options.credentials, 'omit');
    assert.equal(JSON.parse(options.body).variables.username, 'coder');
    return response(leetcode([submission('1')]));
  };
  assert.equal((await verifyActivity(request, { fetcher, now, env: {} })).count, 1);
  await assert.rejects(verifyActivity({ ...request, minimum: 2 }, { fetcher, now, env: {} }), /1\/2/);
});
test('Kaggle paginates with server-only authentication and deduplicates notebook references', async () => {
  let calls = 0;
  const fetcher = async (url, options) => {
    assert.equal(url.origin, 'https://www.kaggle.com');
    assert.equal(url.pathname, '/api/v1/kernels/list');
    assert.equal(url.searchParams.get('user'), 'coder');
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    assert.equal(options.redirect, 'error');
    return response(++calls === 1 ? Array.from({ length: 100 }, (_, index) => notebook(`coder/n${index}`)) : [notebook('coder/n1')]);
  };
  const result = await verifyActivity({ ...request, provider: 'kaggle' }, { fetcher, now, env: { KAGGLE_API_TOKEN: 'test-secret' } });
  assert.equal(calls, 2);
  assert.equal(result.count, 100);
  assert.equal(JSON.stringify(result).includes('test-secret'), false);
});
test('Kaggle supports legacy credentials and fails without making requests when credentials are absent', async () => {
  await assert.rejects(verifyActivity({ ...request, provider: 'kaggle' }, { now, env: {}, fetcher: () => assert.fail('unexpected network call') }), /not configured/);
  await verifyActivity({ ...request, provider: 'kaggle' }, { now, env: { KAGGLE_USERNAME: 'coder', KAGGLE_KEY: 'key' },
    fetcher: async (_url, options) => {
      assert.equal(options.headers.Authorization, `Basic ${Buffer.from('coder:key').toString('base64')}`);
      return response([notebook()]);
    } });
});
test('provider errors never expose raw request details or credentials', async () => {
  await assert.rejects(verifyActivity(request, { now, fetcher: async () => new Response('', { status: 429 }) }), /rate limit/);
  await assert.rejects(verifyActivity({ ...request, provider: 'kaggle' }, { now, env: { KAGGLE_API_TOKEN: 'secret' },
    fetcher: async () => { throw new Error('Authorization: Bearer secret'); } }), error => !error.message.includes('secret'));
});
