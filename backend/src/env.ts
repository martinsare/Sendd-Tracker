import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 5174),
  dbPath: process.env.DB_PATH ?? "./data/senedd-tracker.sqlite",
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 60 * 60 * 24),
};

