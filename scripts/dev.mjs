import { spawn } from 'node:child_process';
import { createVerificationServer } from '../server/http.mjs';

const server = createVerificationServer();
let vite;
server.on('error', error => { console.error(`Verification service failed: ${error.code}`); process.exitCode = 1; });
server.listen(5174, '127.0.0.1', () => {
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5173', '--strictPort', ...process.argv.slice(2)], { stdio: 'inherit' });
  vite.on('error', () => { console.error('Could not start Vite. Run npm ci first.'); server.close(); process.exitCode = 1; });
  vite.on('exit', code => { server.close(); process.exitCode = code || 0; });
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { vite?.kill(signal); server.close(); });
