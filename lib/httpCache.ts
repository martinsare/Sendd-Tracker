import { createHash } from "node:crypto";
import { query } from "./db";
import { env } from "./env";

type CachedResponse = {
  status: number;
  body: string;
  contentType: string | null;
  fromCache: boolean;
};

function hashKey(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export async function cachedFetchText(args: {
  url: string;
  source: string;
  ttlSeconds?: number;
  cacheKeyHint?: string;
  headers?: Record<string, string>;
}): Promise<CachedResponse> {
  const now = Date.now();
  const ttlSeconds = args.ttlSeconds ?? env.cacheTtlSeconds;
  const cacheKey = hashKey(`${args.source}:${args.cacheKeyHint ?? args.url}`);

  const { rows } = await query<{
    status: number;
    body: string;
    contenttype: string | null;
    expiresat: string;
  }>(
    `SELECT status, response_body as body, content_type as contenttype, expires_at as expiresat
     FROM http_cache WHERE cache_key = $1`,
    [cacheKey]
  );

  const row = rows[0];
  if (row && Number(row.expiresat) > now) {
    return {
      status: row.status,
      body: row.body,
      contentType: row.contenttype,
      fromCache: true,
    };
  }

  const res = await fetch(args.url, {
    headers: {
      "user-agent":
        "SeneddTrackerMVP/1.0 (+academic project; caching enabled)",
      ...(args.headers ?? {}),
    },
  });
  const body = await res.text();
  const contentType = res.headers.get("content-type");
  const fetchedAt = now;
  const expiresAt = now + ttlSeconds * 1000;

  await query(
    `INSERT INTO http_cache(cache_key, url, status, response_body, content_type, fetched_at, expires_at, source)
     VALUES($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(cache_key) DO UPDATE SET
       url=EXCLUDED.url,
       status=EXCLUDED.status,
       response_body=EXCLUDED.response_body,
       content_type=EXCLUDED.content_type,
       fetched_at=EXCLUDED.fetched_at,
       expires_at=EXCLUDED.expires_at,
       source=EXCLUDED.source`,
    [cacheKey, args.url, res.status, body, contentType, fetchedAt, expiresAt, args.source]
  );

  return { status: res.status, body, contentType, fromCache: false };
}

export async function purgeExpiredCache() {
  await query(`DELETE FROM http_cache WHERE expires_at <= $1`, [Date.now()]);
}
