import type { Router } from "express";
import type { Db } from "../db.js";
import { Readable } from "node:stream";

function seneddBigPicUrl(uid: number) {
  const last3 = String(uid % 1000).padStart(3, "0");
  const dirs = `${last3[2]}/${last3[1]}/${last3[0]}`;
  const info = String(uid).padStart(8, "0");
  return `https://business.senedd.wales/UserData/${dirs}/Info${info}/bigpic.jpg`;
}

export function registerMemberRoutes(router: Router, db: Db) {
  router.get("/members/:id/photo", async (req, res) => {
    const id = String(req.params.id);
    const row = db
      .prepare(`SELECT senedd_uid as seneddUid, image_url as imageUrl FROM members WHERE id = ?`)
      .get(id) as { seneddUid: number | null; imageUrl: string | null } | undefined;

    if (!row) return res.status(404).end();

    const upstreamUrl = row.seneddUid != null ? seneddBigPicUrl(row.seneddUid) : row.imageUrl;
    if (!upstreamUrl) return res.status(404).end();

    try {
      const upstream = await fetch(upstreamUrl, {
        headers: {
          // Senedd Business blocks some non-browser user agents.
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
          accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });

      if (!upstream.ok) return res.status(404).end();
      if (!upstream.body) return res.status(502).end();

      const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
      const cacheControl = upstream.headers.get("cache-control") ?? "public, max-age=86400";

      res.status(200);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", cacheControl);

      const body = Readable.fromWeb(upstream.body as any);
      body.on("error", () => {
        if (!res.headersSent) res.status(502);
        res.end();
      });
      return body.pipe(res);
    } catch {
      return res.status(502).end();
    }
  });

  router.get("/members/:id", (req, res) => {
    const id = String(req.params.id);
    const row = db
      .prepare(
        `SELECT
           id,
           name,
           party,
           area_name as areaName,
           area_type as areaType,
           profile_url as profileUrl,
           senedd_uid as seneddUid,
           image_url as rawImageUrl,
           updated_at as updatedAt
         FROM members WHERE id = ?`,
      )
      .get(id) as
      | {
        id: string;
        name: string;
        party: string | null;
        areaName: string | null;
        areaType: string | null;
        profileUrl: string | null;
        seneddUid: number | null;
        rawImageUrl: string | null;
        updatedAt: number;
      }
      | undefined;

    if (!row) return res.status(404).json({ error: "Member not found (not cached yet)" });

    const imageUrl = row.seneddUid != null || row.rawImageUrl ? `/api/members/${encodeURIComponent(row.id)}/photo` : null;

    return res.json({
      id: row.id,
      name: row.name,
      party: row.party,
      areaName: row.areaName,
      areaType: row.areaType,
      profileUrl: row.profileUrl,
      imageUrl,
      updatedAt: row.updatedAt,
    });
  });
}
