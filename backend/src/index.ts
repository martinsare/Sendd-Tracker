import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./env.js";
import { openDb } from "./db.js";
import { purgeExpiredCache } from "./httpCache.js";
import { registerSearchRoutes } from "./routes/search.js";
import { registerAvailabilityRoutes } from "./routes/availability.js";
import { registerRecordRoutes } from "./routes/record.js";
import { registerMemberRoutes } from "./routes/members.js";
import { registerParticipationRoutes } from "./routes/participation.js";
import { registerRefreshRoutes } from "./routes/refresh.js";
import { registerContributionRoutes } from "./routes/contributions.js";

const db = openDb();
purgeExpiredCache(db);

const app = express();
// Avoid browser/proxy HTTP caching in the MVP API layer.
// We already cache upstream sources in SQLite; client-side caching can hide updates during development.
app.set("etag", false);
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const api = express.Router();
api.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

api.get("/health", (_req, res) => res.json({ ok: true, name: "senedd-tracker-backend" }));
registerAvailabilityRoutes(api);
registerSearchRoutes(api, db);
registerRecordRoutes(api, db);
registerMemberRoutes(api, db);
registerParticipationRoutes(api, db);
registerRefreshRoutes(api, db);
registerContributionRoutes(api, db);

app.use("/api", api);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[backend] listening on http://localhost:${env.port}`);
});
