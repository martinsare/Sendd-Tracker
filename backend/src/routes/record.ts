import type { Router } from "express";
import type { Db } from "../db.js";
import { listRecentPlenaryExports } from "../sources/record.js";

export function registerRecordRoutes(router: Router, db: Db) {
  router.get("/record/plenary/exports", async (req, res) => {
    const limit = Math.max(1, Math.min(25, Number(req.query.limit ?? 10)));
    try {
      const out = await listRecentPlenaryExports(db, limit);
      res.json(out);
    } catch (e: any) {
      res.status(502).json({ error: "Upstream record fetch failed", detail: String(e?.message ?? e) });
    }
  });
}

