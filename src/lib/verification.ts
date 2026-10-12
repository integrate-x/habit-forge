import { localDateKey } from './completions.ts';

export function countGitHubActivities(events: unknown[], date: string): number {
  const ids = new Set<string>();
  for (const value of events) {
    if (!value || typeof value !== 'object') continue;
    const event = value as { id?: unknown; type?: unknown; created_at?: unknown; payload?: { action?: unknown } };
    if (typeof event.id !== 'string' || typeof event.created_at !== 'string' ||
      !Number.isFinite(Date.parse(event.created_at)) || localDateKey(new Date(event.created_at)) !== date) continue;
    if (event.type === 'PushEvent' || ((event.type === 'PullRequestEvent' || event.type === 'IssuesEvent') && event.payload?.action === 'opened')) ids.add(event.id);
  }
  return ids.size;
}

export async function verifyGitHub(username: string, minimum: number, now = new Date(), fetcher = fetch): Promise<number> {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username)) throw new Error('Enter a valid GitHub username in the habit editor.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const events: unknown[] = [];
    for (let page = 1; page <= 3; page++) {
      const response = await fetcher(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100&page=${page}`, {
        headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 403 || response.status === 429
        ? 'GitHub rate limit reached. Retry later.' : `GitHub returned HTTP ${response.status}.`);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('GitHub returned an unexpected response.');
      events.push(...data);
      if (data.length < 100) break;
    }
    const count = countGitHubActivities(events, localDateKey(now));
    if (count < minimum) throw new Error(`${count}/${minimum} public activities found today. GitHub events can be delayed; private activity is not checked.`);
    return count;
  } finally { clearTimeout(timeout); }
}
