const cache = new Map<string, { data: unknown; ts: number }>();
const inflight = new Map<string, Promise<unknown>>();

const TTL_MS = 30_000; // 30s default cache

export async function cachedFetch<T>(
  url: string,
  init?: RequestInit,
  ttl = TTL_MS
): Promise<T> {
  const key = `${init?.method ?? "GET"} ${url}`;
  const now = Date.now();

  // Return cached if fresh
  const hit = cache.get(key);
  if (hit && now - hit.ts < ttl) return hit.data as T;

  // Deduplicate inflight requests
  if (inflight.has(key)) return inflight.get(key) as Promise<T>;

  const promise = fetch(url, init)
    .then((r) => {
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json() as Promise<T>;
    })
    .then((data) => {
      cache.set(key, { data, ts: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.endsWith(prefix) || key.includes(prefix)) {
      cache.delete(key);
    }
  }
}
