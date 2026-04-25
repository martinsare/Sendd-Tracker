import type { Router } from "express";
import { z } from "zod";
import type { Db } from "../db.js";
import { lookupSeneddAreasByPostcode } from "../sources/mapit.js";
import { ensureMemberDirectorySeeded, findMembersForAreas, searchMembersByAreaOrName } from "../services/memberDirectory.js";

const querySchema = z.object({
  q: z.string().min(1).max(200),
});

function looksLikeUkPostcode(input: string) {
  const s = input.trim().toUpperCase();
  // Loose UK postcode check; final mapping is handled by MapIt.
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(s) || /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(s);
}

export function registerSearchRoutes(router: Router, db: Db) {
  router.get("/search", async (req, res) => {
    const parsed = querySchema.safeParse({ q: req.query.q });
    if (!parsed.success) return res.status(400).json({ error: "Invalid query" });

    const q = parsed.data.q.trim();

    try {
      if (looksLikeUkPostcode(q)) {
        await ensureMemberDirectorySeeded(db);
        const areas = await lookupSeneddAreasByPostcode(db, q);
        const members = findMembersForAreas(db, { constituencyName: areas.constituencyName, regionName: areas.regionName });
        return res.json({
          kind: "postcode",
          query: q,
          areas: {
            constituency: areas.constituencyName ?? null,
            region: areas.regionName ?? null,
          },
          members,
          sourceUrl: areas.mapitUrl,
          fromCache: areas.fromCache,
          notes: members.length === 0 ? ["No members matched the mapped constituency/region yet. Try searching by member name."] : [],
        });
      }

      await ensureMemberDirectorySeeded(db);
      const members = searchMembersByAreaOrName(db, q);
      return res.json({
        kind: "constituency_or_ward",
        query: q,
        members,
        sourceUrl: "https://business.senedd.wales/mgwebservice.asmx/GetElectionResults",
        fromCache: true,
      });
    } catch (e: any) {
      return res.status(502).json({
        error: "Upstream lookup failed",
        detail: String(e?.message ?? e),
      });
    }
  });
}
