import { localDateKey } from './completions.ts';
import { isDesktop, nativeCommand } from './desktop.ts';

export async function verifyProvider(provider: 'leetcode' | 'kaggle', username: string, minimum: number, now = new Date(), fetcher = fetch) {
  if (!/^[a-z\d][a-z\d_-]{0,39}$/i.test(username)) throw new Error('Enter a valid provider username in the habit editor.');
  if (!Number.isInteger(minimum) || minimum < 1 || minimum > 100) throw new Error('Provider requirements must be an integer from 1 to 100.');
  const localDate = localDateKey(now);
  const request = { provider, username, minimum, localDate, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  let response: Response;
  try {
    response = isDesktop()
      ? new Response(JSON.stringify(await nativeCommand('verify_native', { request })))
      : await fetcher('/api/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Habit-Forge-Verify': '1' },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify(request),
    });
  } catch (error) {
    if (isDesktop()) throw new Error(typeof error === 'string' ? error : 'Native provider verification failed.');
    throw new Error('Could not reach the verification service. Start npm run dev:full or retry later.');
  }
  let result: unknown;
  try { result = await response.json(); }
  catch { throw new Error('Verification service unavailable. Start npm run dev:full and retry.'); }
  const data = result as { provider?: string; username?: string; localDate?: string; count?: number; unit?: string; error?: string };
  if (!response.ok) throw new Error(data && typeof data.error === 'string' ? data.error : 'Provider verification failed.');
  if (!data || data.provider !== provider || data.username !== username || data.localDate !== localDate ||
    !Number.isInteger(data.count) || data.count! < minimum || typeof data.unit !== 'string' || !data.unit) {
    throw new Error('Verification service returned an unexpected result. No completion recorded.');
  }
  return { count: data.count!, unit: data.unit };
}
