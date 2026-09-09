import { createHash } from "node:crypto";
import { getConvexClient, isConvexConfigured } from "./db";
import { api } from "../convex/_generated/api";
import { env } from "./env";

type CachedResponse = {
  status: number;
  body: string;
  contentType: string | null;
  fromCache: boolean;
};

// Fast local memory cache
const memoryCache = new Map<string, { status: number; body: string; contentType: string | null; expiresAt: number }>();

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

  // 1. Check in-memory cache
  const mem = memoryCache.get(cacheKey);
  if (mem && mem.expiresAt > now) {
    return {
      status: mem.status,
      body: mem.body,
      contentType: mem.contentType,
      fromCache: true,
    };
  }

  // 2. Check Convex cache if configured
  if (isConvexConfigured()) {
    try {
      const client = getConvexClient();
      if (client) {
        const row = await client.query(api.httpCache.get, { cacheKey });
        if (row && Number(row.expires_at) > now) {
          memoryCache.set(cacheKey, {
            status: row.status,
            body: row.response_body,
            contentType: row.content_type ?? null,
            expiresAt: Number(row.expires_at),
          });
          return {
            status: row.status,
            body: row.response_body,
            contentType: row.content_type ?? null,
            fromCache: true,
          };
        }
      }
    } catch {
      // Continue to live fetch
    }
  }

  // 3. Live network fetch
  const res = await fetch(args.url, {
    headers: {
      "user-agent": "SeneddTrackerMVP/1.0 (+academic project; caching enabled)",
      ...(args.headers ?? {}),
    },
  });
  const body = await res.text();
  const contentType = res.headers.get("content-type");
  const expiresAt = now + ttlSeconds * 1000;

  memoryCache.set(cacheKey, {
    status: res.status,
    body,
    contentType,
    expiresAt,
  });

  if (isConvexConfigured()) {
    try {
      const client = getConvexClient();
      if (client) {
        await client.mutation(api.httpCache.upsert, {
          cache_key: cacheKey,
          url: args.url,
          status: res.status,
          response_body: body,
          content_type: contentType ?? undefined,
          fetched_at: now,
          expires_at: expiresAt,
          source: args.source,
        });
      }
    } catch {
      // Ignore cache upsert error
    }
  }

  return { status: res.status, body, contentType, fromCache: false };
}

export async function purgeExpiredCache() {
  const now = Date.now();
  for (const [k, v] of memoryCache.entries()) {
    if (v.expiresAt <= now) memoryCache.delete(k);
  }

  if (isConvexConfigured()) {
    try {
      const client = getConvexClient();
      if (client) {
        await client.mutation(api.httpCache.purgeExpired, { now });
      }
    } catch {
      // Ignore purge errors
    }
  }
}
