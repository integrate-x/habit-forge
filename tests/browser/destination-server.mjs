import { createServer } from 'node:http';

// Real local responses avoid network interception bypassing extension blocking.
createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
  response.end('<!doctype html><html lang="en"><title>Acceptance destination</title><h1>Acceptance destination</h1></html>');
}).listen(4180, '127.0.0.1');
