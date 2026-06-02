import { Pool, types, type PoolClient } from "pg";
import { requireEnv } from "@/lib/env";

// Return Postgres DATE (oid 1082) as the raw YYYY-MM-DD string instead of a
// JS Date. The schema types in lib/db/types.ts declare date columns as
// `string`, and rendering a Date directly in JSX throws ("Objects are not
// valid as a React child").
types.setTypeParser(types.builtins.DATE, (val) => val);

// BIGSERIAL/BIGINT (oid 20) ships as a string from pg by default to preserve
// precision beyond 2^53. Single-user app — ids never get that large — and the
// TS row types declare them as `number`, so coerce here to keep runtime in
// sync with the types and let Zod `z.number()` accept ids from forms.
types.setTypeParser(types.builtins.INT8, (val) => Number(val));

// Single owned Postgres (Hard Rule §5). Connection via DATABASE_URL.
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

// Lazy so `next build` (which imports server modules without a live DB) doesn't
// trip the DATABASE_URL check; the first actual query fails fast with a clear
// message instead of an opaque ECONNREFUSED to Postgres' default localhost.
function getPool(): Pool {
  if (global.__pgPool) return global.__pgPool;
  const created = new Pool({ connectionString: requireEnv("DATABASE_URL"), max: 5 });
  global.__pgPool = created;
  return created;
}

const pool = new Proxy({} as Pool, {
  get(_t, prop) {
    const p = getPool();
    const v = p[prop as keyof Pool];
    return typeof v === "function" ? v.bind(p) : v;
  },
});

// Anything with `.query` — the pool, or a client inside a transaction.
export type Executor = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
  executor: Executor = pool
): Promise<T[]> {
  const res = await executor.query(text, params);
  return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
  executor: Executor = pool
): Promise<T | null> {
  const rows = await query<T>(text, params, executor);
  return rows[0] ?? null;
}

// Run a set of writes atomically. The callback receives the transaction client
// to thread into query-layer functions via their `executor` param.
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export { pool };
