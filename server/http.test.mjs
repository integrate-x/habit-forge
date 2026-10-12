import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { createVerificationServer } from './http.mjs';

test('local HTTP service restricts host, origin, request type and size and sanitizes errors', async t => {
  let calls = 0;
  const server = createVerificationServer({ verify: async value => {
    calls++;
    if (value.fail) throw new Error('Authorization secret');
    return { count: 1 };
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json', 'X-Habit-Forge-Verify': '1' };
  const post = (body = '{}', extraHeaders = {}) => fetch(url + '/api/verify', { method: 'POST', headers: { ...headers, ...extraHeaders }, body });
  assert.equal((await fetch(url + '/health')).status, 200);
  assert.equal((await post('{}', { Origin: 'https://evil.test' })).status, 403);
  const untrustedHost = await new Promise((resolve, reject) => {
    const outgoing = httpRequest(url + '/api/verify', { method: 'POST', headers: { ...headers, Host: 'evil.test' } }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    outgoing.on('error', reject);
    outgoing.end('{}');
  });
  assert.equal(untrustedHost, 403);
  assert.equal((await post('{}', { 'X-Habit-Forge-Verify': '' })).status, 403);
  assert.equal((await post('{}', { 'Content-Type': 'text/plain' })).status, 403);
  assert.equal((await fetch(url + '/api/verify')).status, 404);
  assert.equal((await post('broken')).status, 400);
  assert.equal((await post(JSON.stringify({ padding: 'a'.repeat(5000) }))).status, 413);
  assert.equal((await post()).status, 200);
  const failure = await post('{"fail":true}');
  assert.equal(failure.status, 500);
  assert.equal((await failure.text()).includes('secret'), false);
  assert.equal(calls, 2);
});
