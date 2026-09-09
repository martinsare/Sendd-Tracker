import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    id: v.string(),
    endpoint: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    metadata: v.optional(v.string()),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("error_logs", args);
  },
});

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const logs = await ctx.db
      .query("error_logs")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
    return logs;
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("error_logs").collect();
    for (const log of all) {
      await ctx.db.delete(log._id);
    }
    return { count: all.length };
  },
});

