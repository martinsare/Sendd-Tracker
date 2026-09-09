import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getByMember = query({
  args: { memberId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const lim = args.limit ?? 50;
    return await ctx.db
      .query("spoken_contributions")
      .withIndex("by_member_id", (q) => q.eq("member_id", args.memberId))
      .order("desc")
      .take(lim);
  },
});

export const getDetail = query({
  args: { meetingId: v.number(), contributionId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("spoken_contributions")
      .withIndex("by_meeting_and_contrib", (q) =>
        q.eq("meeting_id", args.meetingId).eq("contribution_id", args.contributionId),
      )
      .collect();
  },
});

export const upsertMany = mutation({
  args: {
    contributions: v.array(
      v.object({
        meeting_id: v.number(),
        contribution_id: v.number(),
        member_id: v.string(),
        speaker_name: v.string(),
        occurred_at: v.string(),
        context_en: v.optional(v.string()),
        context_cy: v.optional(v.string()),
        snippet_en: v.string(),
        snippet_cy: v.optional(v.string()),
        full_text_en: v.optional(v.string()),
        full_text_cy: v.optional(v.string()),
        source_url: v.string(),
        confidence: v.string(),
        extracted_at: v.number(),
        last_updated_at: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const c of args.contributions) {
      const existing = await ctx.db
        .query("spoken_contributions")
        .withIndex("by_meeting_and_contrib", (q) =>
          q.eq("meeting_id", c.meeting_id).eq("contribution_id", c.contribution_id),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, c);
      } else {
        await ctx.db.insert("spoken_contributions", c);
      }
    }
  },
});

