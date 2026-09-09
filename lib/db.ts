import { ConvexHttpClient } from "convex/browser";

declare global {
  // eslint-disable-next-line no-var
  var _convexClient: ConvexHttpClient | null | undefined;
}

export function isConvexConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  return Boolean(url && url.startsWith("http"));
}

export function getConvexClient(): ConvexHttpClient | null {
  if (globalThis._convexClient === undefined) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
    if (!url || !url.startsWith("http")) {
      globalThis._convexClient = null;
    } else {
      globalThis._convexClient = new ConvexHttpClient(url);
    }
  }
  return globalThis._convexClient;
}

// In-memory fallback stores for when Convex is not yet connected
export const localDb = {
  members: new Map<string, any>(),
  httpCache: new Map<string, any>(),
  spokenContributions: new Map<string, any>(),
  memberVotes: new Map<string, any>(),
  errorLogs: [] as Array<{
    id: string;
    endpoint: string;
    message: string;
    stack?: string;
    metadata?: string;
    created_at: number;
  }>,
};

