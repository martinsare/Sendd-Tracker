export const env = {
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 60 * 60 * 24),
  twfyApiKey: process.env.TWFY_API_KEY ?? "",
};
