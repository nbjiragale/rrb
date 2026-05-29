import { Pool } from "pg";

// Single owned Postgres (Hard Rule §5). Connection via DATABASE_URL.
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

const pool =
  global.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") global.__pgPool = pool;

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export { pool };
