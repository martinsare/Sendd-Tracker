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
           COALESCE(
             CASE
               WHEN senedd_uid IS NULL THEN NULL
               ELSE
                 'https://business.senedd.wales/UserData/' ||
                 substr(printf('%03d', senedd_uid % 1000), 3, 1) || '/' ||
                 substr(printf('%03d', senedd_uid % 1000), 2, 1) || '/' ||
                 substr(printf('%03d', senedd_uid % 1000), 1, 1) ||
                 '/Info' || printf('%08d', senedd_uid) || '/bigpic.jpg'
             END,
             image_url
           ) as imageUrl,
           updated_at as updatedAt
         FROM members WHERE id = ?`,
      )
      .get(id);

    if (!row) return res.status(404).json({ error: "Member not found (not cached yet)" });
    return res.json(row);
  });
}
