import type { Router } from "express";
import { z } from "zod";
import type { Db } from "../db.js";
import { indexRecentPlenarySpokenContributions } from "../extract/spokenContributions.js";
import { indexRecentPlenaryVotes } from "../extract/votes.js";
import { ensureMemberDirectorySeeded } from "../services/memberDirectory.js";

const bodySchema = z
  .object({
    maxMeetings: z.number().int().min(1).max(20).optional(),
    force: z.boolean().optional(),
  })
  .optional();

export function registerRefreshRoutes(router: Router, db: Db) {
  router.post("/refresh", async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

    const maxMeetings = parsed.data?.maxMeetings ?? 8;
    const force = parsed.data?.force ?? false;

    try {
      const startedAt = new Date().toISOString();
      await ensureMemberDirectorySeeded(db);
      const spoken = await indexRecentPlenarySpokenContributions(db, { maxMeetings, force });
      const votes = await indexRecentPlenaryVotes(db, { maxMeetings, force });
      const inserted = spoken.meetings.reduce((sum, m) => sum + (m.contributionsInserted ?? 0), 0);
      const votesUpserted = votes.meetings.reduce((sum, m) => sum + (m.rowsUpserted ?? 0), 0);
      res.json({
        ok: true,
        startedAt,
        finishedAt: new Date().toISOString(),
        maxMeetings,
        force,
        meetings: spoken.meetings,
        votesMeetings: votes.meetings,
        contributionsInserted: inserted,
        votesRowsUpserted: votesUpserted,
      });
    } catch (e: any) {
      res.status(502).json({ ok: false, error: "Refresh failed", detail: String(e?.message ?? e) });
    }
  });
}
