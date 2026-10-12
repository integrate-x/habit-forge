import { createServer } from 'node:http';

// Real local responses avoid network interception bypassing extension blocking.
const desktopStates = new Map();
createServer(async (request, response) => {
  if (request.url === '/desktop-test-state' && request.method === 'POST') {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const data = JSON.parse(raw);
    desktopStates.set(data.token, data.snapshot);
    response.end('ok'); return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
  response.end('<!doctype html><html lang="en"><title>Acceptance destination</title><h1>Acceptance destination</h1></html>');
}).listen(4180, '127.0.0.1');

createServer((request, response) => {
  const token = request.headers.authorization?.replace(/^Bearer /, '');
  const snapshot = desktopStates.get(token);
  response.writeHead(snapshot ? 200 : 403, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(snapshot || { error: 'Unauthorized' }));
}).listen(5175, '127.0.0.1');
