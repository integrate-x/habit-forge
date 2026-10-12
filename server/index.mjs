import { createVerificationServer } from './http.mjs';

const server = createVerificationServer();
server.listen(5174, '127.0.0.1', () => console.log('Verification service: http://127.0.0.1:5174'));
server.on('error', error => { console.error(`Verification service failed: ${error.code}`); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
