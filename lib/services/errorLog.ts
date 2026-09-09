import { getConvexClient, isConvexConfigured, localDb } from "../db";

export type ErrorLogEntry = {
  id: string;
  endpoint: string;
  message: string;
  stack?: string;
  metadata?: string;
  created_at: number;
};

function generateErrorRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "ERR-";
  for (let i = 0; i < 6; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export async function logServerSideError(args: {
  endpoint: string;
  error: unknown;
  metadata?: Record<string, any>;
}): Promise<{ errorRef: string; publicMessage: string }> {
  const errorRef = generateErrorRef();
  const message = args.error instanceof Error ? args.error.message : String(args.error ?? "Unknown error");
  const stack = args.error instanceof Error ? args.error.stack : undefined;
  const metadataStr = args.metadata ? JSON.stringify(args.metadata) : undefined;
  const created_at = Date.now();

  const entry: ErrorLogEntry = {
    id: errorRef,
    endpoint: args.endpoint,
    message,
    stack,
    metadata: metadataStr,
    created_at,
  };

  // 1. Store in local fallback array
  localDb.errorLogs.unshift(entry);
  if (localDb.errorLogs.length > 500) {
    localDb.errorLogs.pop();
  }

  // 2. Persist in Convex if configured
  if (isConvexConfigured()) {
    try {
      const client = getConvexClient();
      if (client) {
        await (client as any).mutation("errorLogs:insert", entry);
      }
    } catch (e) {
      console.error("[ErrorLogger] Failed to write error to Convex:", e);
    }
  }

  console.error(`[${errorRef}] Error at ${args.endpoint}: ${message}`);

  return {
    errorRef,
    publicMessage: "Unable to complete request. Please try again later.",
  };
}

export async function fetchAllErrorLogs(limit = 100): Promise<ErrorLogEntry[]> {
  if (isConvexConfigured()) {
    try {
      const client = getConvexClient();
      if (client) {
        const rows = await (client as any).query("errorLogs:listRecent", { limit });
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map((r: any) => ({
            id: r.id ?? r._id,
            endpoint: r.endpoint,
            message: r.message,
            stack: r.stack,
            metadata: r.metadata,
            created_at: r.created_at,
          }));
        }
      }
    } catch (e) {
      console.error("[ErrorLogger] Failed to read from Convex:", e);
    }
  }

  return localDb.errorLogs.slice(0, limit);
}

export async function clearErrorLogs(): Promise<{ count: number }> {
  let count = localDb.errorLogs.length;
  localDb.errorLogs = [];

  if (isConvexConfigured()) {
    try {
      const client = getConvexClient();
      if (client) {
        const res = await (client as any).mutation("errorLogs:clearAll", {});
        if (res && typeof res.count === "number") {
          count = res.count;
        }
      }
    } catch (e) {
      console.error("[ErrorLogger] Failed to clear in Convex:", e);
    }
  }

  return { count };
}

