import type { Router } from "express";
import { z } from "zod";
import type { Db } from "../db.js";
import { backfillPlenaryMeetingSpokenContributions } from "../extract/spokenContributions.js";

const paramsSchema = z.object({
  meetingId: z.coerce.number().int().positive(),
  contributionId: z.coerce.number().int().nonnegative(),
});

const querySchema = z.object({
  memberId: z.string().min(1).max(200).optional(),
});

export function registerContributionRoutes(router: Router, db: Db) {
  router.get("/spoken/:meetingId/:contributionId", async (req, res) => {
    const p = paramsSchema.safeParse({ meetingId: req.params.meetingId, contributionId: req.params.contributionId });
    if (!p.success) return res.status(400).json({ error: "Invalid params" });

    const q = querySchema.safeParse({ memberId: req.query.memberId });
    if (!q.success) return res.status(400).json({ error: "Invalid query" });

    const whereMember = q.data.memberId ? "AND member_id = @memberId" : "";
    const selectStmt = db.prepare(
      `SELECT
         meeting_id as meetingId,
         contribution_id as contributionId,
         member_id as memberId,
         speaker_name as speakerName,
         occurred_at as occurredAt,
         context_en as contextEn,
         context_cy as contextCy,
         snippet_en as snippetEn,
         snippet_cy as snippetCy,
         full_text_en as fullTextEn,
         full_text_cy as fullTextCy,
         source_url as sourceUrl,
         confidence
       FROM spoken_contributions
       WHERE meeting_id = @meetingId AND contribution_id = @contributionId ${whereMember}
       LIMIT 1`,
    );

    const getRow = () =>
      selectStmt.get({
        meetingId: p.data.meetingId,
        contributionId: p.data.contributionId,
        memberId: q.data.memberId ?? null,
      }) as
        | {
            meetingId: number;
            contributionId: number;
            memberId: string;
            speakerName: string;
            occurredAt: string;
            contextEn: string | null;
            contextCy: string | null;
            snippetEn: string;
            snippetCy: string | null;
            fullTextEn: string | null;
            fullTextCy: string | null;
            sourceUrl: string;
            confidence: "high" | "medium" | "low";
          }
        | undefined;

    let row = getRow();

    if (!row) return res.status(404).json({ error: "Contribution not found (try refreshing data)" });

    const missingBoth =
      (!row.fullTextEn || !row.fullTextEn.trim()) && (!row.fullTextCy || !row.fullTextCy.trim());
    if (missingBoth) {
      try {
        // On-demand backfill: older meetings may not be indexed yet for full text, but the official export is available.
        // Uses backend caching to avoid unnecessary repeated upstream calls.
        await backfillPlenaryMeetingSpokenContributions(db, { meetingId: row.meetingId });
        row = getRow() ?? row;
      } catch {
        // Best-effort only; fall through with original row.
      }
    }

    const transcript = db
      .prepare(`SELECT transcript_url as transcriptUrl FROM plenary_transcripts WHERE meeting_id = ?`)
      .get(row.meetingId) as { transcriptUrl: string } | undefined;

    res.json({
      ...row,
      transcriptXmlUrl: transcript?.transcriptUrl ?? null,
      recordPageUrl: `https://record.senedd.wales/Plenary/${row.meetingId}`,
    });
  });
}
