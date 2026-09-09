import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("members")
      .withIndex("by_member_id", (q) => q.eq("id", args.id))
      .first();
  },
});

export const search = query({
  args: { q: v.string() },
  handler: async (ctx, args) => {
    const term = args.q.trim().toLowerCase();
    if (!term) return [];
    const all = await ctx.db.query("members").collect();
    return all.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.area_name.toLowerCase().includes(term) ||
        (m.party && m.party.toLowerCase().includes(term)),
    );
  },
});

export const upsertMembers = mutation({
  args: {
    members: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        party: v.optional(v.string()),
        area_name: v.string(),
        area_type: v.string(),
        profile_url: v.optional(v.string()),
        image_url: v.optional(v.string()),
        senedd_uid: v.optional(v.number()),
        updated_at: v.number(),
        last_updated_at: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const m of args.members) {
      const existing = await ctx.db
        .query("members")
        .withIndex("by_member_id", (q) => q.eq("id", m.id))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, m);
      } else {
        await ctx.db.insert("members", m);
      }
    }
  },
});

