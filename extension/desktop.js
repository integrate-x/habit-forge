import { isSnapshot } from './policy.js';

export async function readDesktopSnapshot(token, fetcher = fetch) {
  if (!/^[a-f0-9]{64}$/i.test(token || '')) throw new Error('Enter a valid desktop pairing token.');
  let response;
  try {
    response = await fetcher('http://127.0.0.1:5175/snapshot', {
      headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(5000),
    });
  } catch { throw new Error('Desktop app is unavailable. Open Habit Forge and retry.'); }
  if (response.status === 403) throw new Error('Desktop pairing token was not accepted.');
  if (!response.ok) throw new Error('Desktop snapshot is not ready. Retry shortly.');
  const snapshot = await response.json();
  if (!isSnapshot(snapshot)) throw new Error('Desktop returned an invalid snapshot.');
  return snapshot;
}
