/** Small fetch wrapper: timeouts, JSON, and failure that degrades instead of throwing. */
export async function getJSON<T = any>(url: string, opts: { timeoutMs?: number; headers?: Record<string, string> } = {}): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: 'application/json', 'user-agent': process.env.REDDIT_USER_AGENT || 'cresco/0.1', ...opts.headers },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Run promises with a small concurrency cap so we stay polite to free APIs. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export const daysAgoUnix = (days: number) => Math.floor(Date.now() / 1000) - days * 86_400;
