import { createServer } from 'node:http';
import { verifyActivity, VerificationError } from './providers.ts';

const origins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173']);
function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

export function createVerificationServer({ verify = verifyActivity } = {}) {
  let active = 0;
  const server = createServer(async (request, response) => {
    const host = request.headers.host;
    if (![`127.0.0.1:${request.socket.localPort}`, `localhost:${request.socket.localPort}`].includes(host)) {
      send(response, 403, { error: 'Untrusted host.' }); return;
    }
    if (request.url === '/health' && request.method === 'GET') {
      send(response, 200, { ok: true }); return;
    }
    if (request.url !== '/api/verify' || request.method !== 'POST') {
      send(response, 404, { error: 'Not found.' }); return;
    }
    if (!origins.has(request.headers.origin) || request.headers['x-habit-forge-verify'] !== '1' ||
      request.headers['content-type']?.split(';')[0] !== 'application/json') {
      send(response, 403, { error: 'Untrusted verification request.' }); return;
    }
    if (active >= 4) { send(response, 429, { error: 'Verification service is busy. Retry shortly.' }); return; }
    active++;
    try {
      const raw = await new Promise((resolve, reject) => {
        const chunks = [];
        let length = 0;
        request.on('data', chunk => {
          length += chunk.length;
          if (length > 4096) { reject(new VerificationError('Verification request is too large.', 413)); return; }
          chunks.push(chunk);
        });
        request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        request.on('error', reject);
      });
      let value;
      try { value = JSON.parse(raw); }
      catch { throw new VerificationError('Invalid JSON request.', 400); }
      send(response, 200, await verify(value));
    } catch (error) {
      send(response, error instanceof VerificationError ? error.status : 500, {
        error: error instanceof VerificationError ? error.message : 'Verification service failed.',
      });
    } finally { active--; }
  });
  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  return server;
}
