import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 5174),
  dbPath: process.env.DB_PATH ?? "./data/senedd-tracker.sqlite",
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 60 * 60 * 24),
  // Optional: serve the built frontend from the backend (avoids needing Nginx/Caddy on small VMs).
  // Example: /opt/senedd-tracker/frontend/dist
  frontendDistPath: process.env.FRONTEND_DIST_PATH,
};
