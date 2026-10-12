import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { isSnapshot } from '../extension/policy.js';

if (process.platform !== 'win32') throw new Error('The desktop launch smoke test requires Windows.');
const executable = path.resolve('src-tauri/target/release/habit-forge.exe');
const child = spawn(executable, [], { stdio: ['ignore', 'ignore', 'pipe'] });
let failure;
let stderr = '';
child.on('error', error => { failure = error.message; });
child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-2000); });
try {
  const deadline = Date.now() + 30_000;
  let snapshot, token;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || failure) throw new Error('Desktop launch failed: ' + (failure || stderr || child.exitCode));
    try {
      for (const directory of [process.env.APPDATA, process.env.LOCALAPPDATA].filter(Boolean)) {
        try { token = await readFile(path.join(directory, 'com.integratex.habitforge', 'companion-token'), 'utf8'); break; }
        catch { /* The desktop setup may still be starting. */ }
      }
      if (token) {
        const response = await fetch('http://127.0.0.1:5175/snapshot', { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(2000) });
        if (response.ok) { snapshot = await response.json(); break; }
      }
    } catch { /* Poll until the renderer has published its first snapshot. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(snapshot, 'Desktop renderer did not publish a snapshot within 30 seconds. ' + stderr);
  assert.ok(isSnapshot(snapshot), 'Desktop snapshot did not match the companion contract.');
  assert.ok(snapshot.habits.length > 0, 'Fresh desktop data did not initialize.');
  assert.equal(JSON.stringify(snapshot).includes(token), false);
  const denied = await fetch('http://127.0.0.1:5175/snapshot');
  assert.equal(denied.status, 403);
  console.log('Windows launch, webview IPC, data initialization and authenticated companion transport passed.');
} finally {
  if (child.pid && child.exitCode === null) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
}
