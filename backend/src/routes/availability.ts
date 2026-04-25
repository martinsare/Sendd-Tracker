import type { Router } from "express";
import { availabilityMetrics } from "../dataAvailability.js";

export function registerAvailabilityRoutes(router: Router) {
  router.get("/data-availability", (req, res) => {
    res.json({ metrics: availabilityMetrics });
  });
}

