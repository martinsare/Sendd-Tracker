import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  members: defineTable({
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
  })
    .index("by_member_id", ["id"])
    .index("by_area_name", ["area_name"])
    .index("by_name", ["name"]),

  http_cache: defineTable({
    cache_key: v.string(),
    url: v.string(),
    status: v.number(),
    response_body: v.string(),
    content_type: v.optional(v.string()),
    fetched_at: v.number(),
    expires_at: v.number(),
    source: v.string(),
  })
    .index("by_cache_key", ["cache_key"])
    .index("by_expires_at", ["expires_at"]),

  spoken_contributions: defineTable({
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
  })
    .index("by_member_id", ["member_id"])
    .index("by_meeting_and_contrib", ["meeting_id", "contribution_id"])
    .index("by_occurred_at", ["occurred_at"]),

  member_votes: defineTable({
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
  })
    .index("by_member_id", ["member_id"])
    .index("by_occurred_at", ["occurred_at"]),

  error_logs: defineTable({
    id: v.string(),
    endpoint: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    metadata: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_created_at", ["created_at"])
    .index("by_endpoint", ["endpoint"]),
});


