import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const get = query({
  args: { cacheKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("http_cache")
      .withIndex("by_cache_key", (q) => q.eq("cache_key", args.cacheKey))
      .first();
  },
});

export const upsert = mutation({
  args: {
    cache_key: v.string(),
    url: v.string(),
    status: v.number(),
    response_body: v.string(),
    content_type: v.optional(v.string()),
    fetched_at: v.number(),
    expires_at: v.number(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("http_cache")
      .withIndex("by_cache_key", (q) => q.eq("cache_key", args.cache_key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("http_cache", args);
    }
  },
});

export const purgeExpired = mutation({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const expired = await ctx.db
      .query("http_cache")
      .withIndex("by_expires_at", (q) => q.lte("expires_at", args.now))
      .collect();

    for (const item of expired) {
      await ctx.db.delete(item._id);
    }
  },
});

