import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getByMember = query({
  args: { memberId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const lim = args.limit ?? 50;
    return await ctx.db
      .query("member_votes")
      .withIndex("by_member_id", (q) => q.eq("member_id", args.memberId))
      .order("desc")
      .take(lim);
  },
});

export const upsertMany = mutation({
  args: {
    votes: v.array(
      v.object({
        meeting_id: v.number(),
        contribution_id: v.number(),
        vote_row_id: v.optional(v.number()),
        member_id: v.string(),
        member_uid: v.optional(v.number()),
        member_name: v.optional(v.string()),
        occurred_at: v.string(),
        vote_name_en: v.optional(v.string()),
        vote_name_cy: v.optional(v.string()),
        vote_result_en: v.optional(v.string()),
        vote_result_cy: v.optional(v.string()),
        totals_for: v.optional(v.number()),
        totals_against: v.optional(v.number()),
        totals_abstain: v.optional(v.number()),
        member_result: v.string(),
        source_url: v.string(),
        confidence: v.string(),
        extracted_at: v.number(),
        last_updated_at: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const vote of args.votes) {
      const existing = await ctx.db
        .query("member_votes")
        .withIndex("by_member_id", (q) => q.eq("member_id", vote.member_id))
        .filter((q) =>
          q.and(
            q.eq(q.field("meeting_id"), vote.meeting_id),
            q.eq(q.field("contribution_id"), vote.contribution_id),
          ),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, vote);
      } else {
        await ctx.db.insert("member_votes", vote);
      }
    }
  },
});

