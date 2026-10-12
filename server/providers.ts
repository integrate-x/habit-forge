export type Provider = 'leetcode' | 'kaggle';
export interface VerifyRequest {
  provider: Provider;
  username: string;
  minimum: number;
  timeZone: string;
  localDate: string;
}
export interface VerificationResult {
  provider: Provider;
  username: string;
  localDate: string;
  count: number;
  unit: string;
}
export class VerificationError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export function dateInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const field = (type: string) => parts.find(part => part.type === type)!.value;
  return `${field('year')}-${field('month')}-${field('day')}`;
}

export function validateRequest(value: unknown, now = new Date()): VerifyRequest {
  if (!value || typeof value !== 'object') throw new VerificationError('Invalid verification request.', 400);
  const request = value as VerifyRequest;
  if (!['leetcode', 'kaggle'].includes(request.provider) ||
    typeof request.username !== 'string' || !/^[a-z\d][a-z\d_-]{0,39}$/i.test(request.username) ||
    !Number.isInteger(request.minimum) || request.minimum < 1 || request.minimum > 100 ||
    typeof request.timeZone !== 'string' || request.timeZone.length > 100 ||
    typeof request.localDate !== 'string') throw new VerificationError('Invalid provider, username or requirement (1-100).', 400);
  let date: string;
  try { date = dateInZone(now, request.timeZone); }
  catch { throw new VerificationError('Invalid timezone.', 400); }
  if (date !== request.localDate) throw new VerificationError('Date changed. Refresh and retry verification.', 409);
  return request;
}

async function jsonResponse(response: Response, provider: string): Promise<unknown> {
  if (!response.ok) {
    if (response.status === 401) throw new VerificationError(`${provider} authentication failed. Check local API credentials.`, 401);
    if (response.status === 403) throw new VerificationError(`${provider} denied access. Check credentials or retry later; no completion was recorded.`, 403);
    if (response.status === 429) throw new VerificationError(`${provider} rate limit reached. Retry later.`, 429);
    throw new VerificationError(`${provider} returned HTTP ${response.status}.`);
  }
  try { return await response.json(); }
  catch { throw new VerificationError(`${provider} returned an unexpected response.`); }
}

type Submission = { id: string; titleSlug: string; timestamp: string };
export function countLeetCodeProblems(data: unknown, request: VerifyRequest, now: Date): number {
  const result = data as { errors?: unknown[]; data?: { matchedUser?: { username?: string }; recentAcSubmissionList?: Submission[] } };
  if (!result || result.errors?.length || !result.data) throw new VerificationError('LeetCode query failed or its response format changed.');
  if (!result.data.matchedUser) throw new VerificationError('LeetCode username was not found or its activity is private.', 404);
  if (result.data.matchedUser.username?.toLowerCase() !== request.username.toLowerCase() ||
    !Array.isArray(result.data.recentAcSubmissionList)) throw new VerificationError('LeetCode returned an unexpected response.');
  const solved = new Set<string>();
  for (const item of result.data.recentAcSubmissionList) {
    if (!item || typeof item.id !== 'string' || typeof item.titleSlug !== 'string' || !item.titleSlug ||
      typeof item.timestamp !== 'string' || !/^\d+$/.test(item.timestamp)) throw new VerificationError('LeetCode returned an unexpected submission.');
    const date = new Date(Number(item.timestamp) * 1000);
    if (!Number.isFinite(date.getTime())) throw new VerificationError('LeetCode returned an invalid timestamp.');
    if (date <= now && dateInZone(date, request.timeZone) === request.localDate) solved.add(item.titleSlug);
  }
  return solved.size;
}

export function countKaggleNotebooks(data: unknown[], request: VerifyRequest, now: Date): number {
  const notebooks = new Set<string>();
  for (const value of data) {
    const item = value as { ref?: string; lastRunTime?: string | null; isPrivate?: boolean };
    if (!item || typeof item.ref !== 'string' || !/^[^/]+\/[^/]+$/.test(item.ref)) throw new VerificationError('Kaggle returned an unexpected notebook.');
    if (item.ref.split('/')[0].toLowerCase() !== request.username.toLowerCase()) continue;
    if (!item.lastRunTime) continue;
    // Reject timezone-free timestamps rather than interpreting them in the service's timezone.
    if (typeof item.lastRunTime !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(item.lastRunTime)) throw new VerificationError('Kaggle returned an unsupported notebook timestamp.');
    const date = new Date(item.lastRunTime);
    if (!Number.isFinite(date.getTime())) throw new VerificationError('Kaggle returned an invalid notebook timestamp.');
    if (date <= now && dateInZone(date, request.timeZone) === request.localDate) notebooks.add(item.ref.toLowerCase());
  }
  return notebooks.size;
}

export async function verifyActivity(value: unknown, options: {
  fetcher?: typeof fetch; now?: Date; env?: Record<string, string | undefined>;
} = {}): Promise<VerificationResult> {
  const now = options.now || new Date();
  const request = validateRequest(value, now);
  const fetcher = options.fetcher || fetch;
  const env = options.env || process.env;
  const signal = AbortSignal.timeout(15_000);
  let count = 0;
  const unit = request.provider === 'leetcode' ? 'distinct accepted problems' : 'notebooks last run';
  try {
    if (request.provider === 'leetcode') {
      const response = await fetcher('https://leetcode.com/graphql/', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'omit', redirect: 'error', signal,
        body: JSON.stringify({
          query: 'query HabitForgeActivity($username: String!, $limit: Int!) { matchedUser(username: $username) { username } recentAcSubmissionList(username: $username, limit: $limit) { id titleSlug timestamp } }',
          variables: { username: request.username, limit: 100 },
        }),
      });
      count = countLeetCodeProblems(await jsonResponse(response, 'LeetCode'), request, now);
    } else {
      let authorization: string;
      if (env.KAGGLE_API_TOKEN) authorization = `Bearer ${env.KAGGLE_API_TOKEN}`;
      else if (env.KAGGLE_USERNAME && env.KAGGLE_KEY) authorization = `Basic ${Buffer.from(`${env.KAGGLE_USERNAME}:${env.KAGGLE_KEY}`).toString('base64')}`;
      else throw new VerificationError('Kaggle credentials are not configured. Set KAGGLE_API_TOKEN or KAGGLE_USERNAME/KAGGLE_KEY in the local service environment.', 503);
      const records: unknown[] = [];
      for (let page = 1; page <= 3; page++) {
        const url = new URL('https://www.kaggle.com/api/v1/kernels/list');
        url.search = new URLSearchParams({ user: request.username, page: String(page), pageSize: '100', sortBy: 'dateRun', kernelType: 'notebook', group: 'everyone' }).toString();
        const data = await jsonResponse(await fetcher(url, {
          headers: { Accept: 'application/json', Authorization: authorization }, credentials: 'omit', redirect: 'error', signal,
        }), 'Kaggle');
        if (!Array.isArray(data)) throw new VerificationError('Kaggle returned an unexpected response.');
        records.push(...data);
        if (data.length < 100) break;
      }
      count = countKaggleNotebooks(records, request, now);
    }
  } catch (error) {
    if (error instanceof VerificationError) throw error;
    // Never return raw upstream errors that could contain request headers.
    throw new VerificationError(signal.aborted ? 'Verification timed out. Retry later.' : 'Provider request failed. Retry later.');
  }
  if (count < request.minimum) throw new VerificationError(`${count}/${request.minimum} ${unit} found today. Only activity visible to this provider request is checked.`, 422);
  return { provider: request.provider, username: request.username, localDate: request.localDate, count, unit };
}
