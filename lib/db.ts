import { Pool, PoolClient } from "pg";

// Singleton pool — re-used across hot-reloads in dev via globalThis
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis._pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for the Supabase database connection.");
    }
    globalThis._pgPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalThis._pgPool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<{ rows: T[] }> {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return { rows: result.rows as T[] };
}

/** Run a set of queries inside a single transaction. */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
