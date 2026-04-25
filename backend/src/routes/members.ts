import type { Router } from "express";
import type { Db } from "../db.js";

export function registerMemberRoutes(router: Router, db: Db) {
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
           COALESCE(image_url, CASE WHEN senedd_uid IS NOT NULL THEN 'https://business.senedd.wales/mgPhoto.aspx?UID=' || senedd_uid END) as imageUrl,
           updated_at as updatedAt
         FROM members WHERE id = ?`,
      )
      .get(id);

    if (!row) return res.status(404).json({ error: "Member not found (not cached yet)" });
    return res.json(row);
  });
}
