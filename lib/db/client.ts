import { Pool, types, type PoolClient } from "pg";

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

let cachedPool: Pool | undefined;

// Built on first query rather than at import time: `next build` loads route
// modules without a database, and pg treats a missing connection string as
// "connect to localhost", turning a config mistake into an empty AggregateError
// from a host that was never the target.
function getPool(): Pool {
  const existing = cachedPool ?? global.__pgPool;
  if (existing) return existing;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — copy .env.example to .env and fill it in. " +
        "Note that a git worktree does not inherit the main checkout's .env."
    );
  }

  const pool = new Pool({ connectionString, max: 5 });
  cachedPool = pool;
  if (process.env.NODE_ENV !== "production") global.__pgPool = pool;
  return pool;
}

// Node tries every address a host resolves to and, when they all fail, throws
// an AggregateError whose own message is empty — which surfaces in Next as "no
// message was provided". Lift the underlying causes into the message.
function withCauses(err: unknown): unknown {
  if (err instanceof AggregateError && Array.isArray(err.errors)) {
    const causes = err.errors.map((e) => (e instanceof Error ? e.message : String(e)));
    return new Error(`database connection failed: ${causes.join("; ")}`, { cause: err });
  }
  return err;
}

// Anything with `.query` — the pool, or a client inside a transaction.
export type Executor = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
  executor?: Executor
): Promise<T[]> {
  try {
    const res = await (executor ?? getPool()).query(text, params);
    return res.rows as T[];
  } catch (err) {
    throw withCauses(err);
  }
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
  executor?: Executor
): Promise<T | null> {
  const rows = await query<T>(text, params, executor);
  return rows[0] ?? null;
}

// Run a set of writes atomically. The callback receives the transaction client
// to thread into query-layer functions via their `executor` param.
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  let client: PoolClient;
  try {
    client = await getPool().connect();
  } catch (err) {
    throw withCauses(err);
  }
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
