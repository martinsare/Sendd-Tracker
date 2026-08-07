import { createHash } from "node:crypto";
import { supabase } from "./db";
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

  const { data: row } = await supabase()
    .from("http_cache")
    .select("status,response_body,content_type,expires_at")
    .eq("cache_key", cacheKey)
    .maybeSingle<any>();

  if (row && Number(row.expires_at) > now) {
    return {
      status: row.status,
      body: row.response_body,
      contentType: row.content_type,
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

  await (supabase() as any).from("http_cache").upsert({
    cache_key: cacheKey,
    url: args.url,
    status: res.status,
    response_body: body,
    content_type: contentType,
    fetched_at: fetchedAt,
    expires_at: expiresAt,
    source: args.source,
  });

  return { status: res.status, body, contentType, fromCache: false };
}

export async function purgeExpiredCache() {
  await (supabase() as any).from("http_cache").delete().lte("expires_at", Date.now());
}
