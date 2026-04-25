import { createHash } from "node:crypto";
import type { Db } from "./db.js";
import { env } from "./env.js";

type CachedResponse = {
  status: number;
  body: string;
  contentType: string | null;
  fromCache: boolean;
};

function hashKey(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export async function cachedFetchText(
  db: Db,
  args: {
    url: string;
    source: string;
    ttlSeconds?: number;
    cacheKeyHint?: string;
    headers?: Record<string, string>;
  },
): Promise<CachedResponse> {
  const now = Date.now();
  const ttlSeconds = args.ttlSeconds ?? env.cacheTtlSeconds;
  const cacheKey = hashKey(`${args.source}:${args.cacheKeyHint ?? args.url}`);

  const row = db
    .prepare(
      `SELECT status, response_body as body, content_type as contentType, expires_at as expiresAt
       FROM http_cache WHERE cache_key = ?`,
    )
    .get(cacheKey) as
    | { status: number; body: string; contentType: string | null; expiresAt: number }
    | undefined;

  if (row && row.expiresAt > now) {
    return { status: row.status, body: row.body, contentType: row.contentType, fromCache: true };
  }

  const res = await fetch(args.url, {
    headers: {
      "user-agent": "SeneddTrackerMVP/1.0 (+academic project; caching enabled)",
      ...(args.headers ?? {}),
    },
  });
  const body = await res.text();
  const contentType = res.headers.get("content-type");
  const fetchedAt = now;
  const expiresAt = now + ttlSeconds * 1000;

  db.prepare(
    `INSERT INTO http_cache(cache_key, url, status, response_body, content_type, fetched_at, expires_at, source)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       url=excluded.url,
       status=excluded.status,
       response_body=excluded.response_body,
       content_type=excluded.content_type,
       fetched_at=excluded.fetched_at,
       expires_at=excluded.expires_at,
       source=excluded.source`,
  ).run(cacheKey, args.url, res.status, body, contentType, fetchedAt, expiresAt, args.source);

  return { status: res.status, body, contentType, fromCache: false };
}

export function purgeExpiredCache(db: Db) {
  const now = Date.now();
  db.prepare(`DELETE FROM http_cache WHERE expires_at <= ?`).run(now);
}

