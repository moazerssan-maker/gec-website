import postgres from "postgres";

let sql = null;
let ready = null;

export class NoDatabaseError extends Error {
  constructor() { super("DATABASE_URL is not set"); this.code = "no_database"; }
}

/**
 * Find the connection string. Vercel storage integrations may add a custom
 * prefix (e.g. STORAGE_POSTGRES_URL), so accept any *_POSTGRES_URL /
 * *_DATABASE_URL, preferring the pooled URL over *_NON_POOLING / *_UNPOOLED.
 */
export function connectionString(env = process.env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.POSTGRES_URL) return env.POSTGRES_URL;
  const keys = Object.keys(env).filter((k) => /(^|_)(POSTGRES_URL|DATABASE_URL)$/.test(k) && env[k]);
  return keys.length ? env[keys.sort()[0]] : null;
}

/** Names (never values) of database-looking env vars, to explain a missing connection. */
export function dbEnvNames(env = process.env) {
  return Object.keys(env).filter((k) => /POSTGRES|DATABASE|SUPABASE/.test(k)).sort();
}

/**
 * One small client per function instance. Works with Supabase (POSTGRES_URL from
 * the Vercel integration, or a pasted DATABASE_URL) and Neon. Pooled URLs run in
 * transaction mode, so prepared statements are off. Query parameters such as
 * Supabase's `?supa=base-pooler.x` are dropped: postgres.js would otherwise send
 * them to the server as settings, which the pooler rejects; TLS is set here instead.
 */
export function db() {
  const raw = connectionString();
  if (!raw) throw new NoDatabaseError();
  if (!sql) {
    const u = new URL(raw);
    const local = ["localhost", "127.0.0.1"].includes(u.hostname);
    u.search = "";
    sql = postgres(u.toString(), { max: 1, prepare: false, onnotice: () => {}, idle_timeout: 20, connect_timeout: 15, ssl: local ? false : "require" });
  }
  return sql;
}

/** Create tables on first use; idempotent. */
export function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      const s = db();
      await s`
        create table if not exists users (
          id serial primary key,
          username text not null unique,
          name text not null,
          pass_hash text not null,
          role text not null default 'member' check (role in ('admin','member')),
          active boolean not null default true,
          created_at timestamptz not null default now()
        )`;
      await s`
        create table if not exists tracking (
          lead_id integer primary key,
          doc jsonb not null,
          updated_at timestamptz not null default now(),
          updated_by integer references users(id)
        )`;
      await s`create index if not exists tracking_updated_at on tracking (updated_at)`;
      // On Supabase, tables in the public schema are reachable through its REST API
      // with the public anon key. Row level security with no policies closes that
      // door; this app connects as the table owner, which RLS does not restrict.
      await s`alter table users enable row level security`;
      await s`alter table tracking enable row level security`;
      // The establishment directory (table directory, row id 1) was loaded once into
      // the database; it is deliberately not stored in this public repository.
      await s`
        create table if not exists directory (
          id integer primary key,
          data jsonb not null,
          updated_at timestamptz not null default now()
        )`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}
