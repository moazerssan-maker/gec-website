import crypto from "node:crypto";
import { db, ensureSchema, NoDatabaseError, dbEnvNames, connectionString } from "./db.js";

const COOKIE = "gec_s";
const MAX_AGE = 30 * 24 * 3600; // 30 days

/* ---------- Passwords: scrypt with a per-user salt ---------- */
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 32);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}
export function verifyPassword(pw, stored) {
  const [alg, s, k] = String(stored).split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const want = Buffer.from(k, "base64");
  const got = crypto.scryptSync(String(pw), Buffer.from(s, "base64"), want.length);
  return crypto.timingSafeEqual(want, got);
}

/* ---------- Signed session cookie: base64url(json).hmac ---------- */
/**
 * Key for signing session cookies: AUTH_SECRET when set; otherwise derived from
 * the database connection string, which is also server-only and secret, so the
 * site still works if AUTH_SECRET was never added in Vercel.
 */
function secret() {
  const s = (process.env.AUTH_SECRET || "").trim();
  if (s.length >= 16) return s;
  const url = connectionString();
  if (!url) throw Object.assign(new Error("AUTH_SECRET missing"), { code: "no_secret" });
  return crypto.createHash("sha256").update("gec-session-v1:" + url).digest("base64url");
}
const sign = (payload) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

export function sessionCookie(userId, req) {
  const payload = Buffer.from(JSON.stringify({ u: userId, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  const secure = (req.headers["x-forwarded-proto"] || "").includes("https") ? "; Secure" : "";
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

function readSession(req) {
  const raw = String(req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return null;
  const [payload, mac] = raw.slice(COOKIE.length + 1).split(".");
  if (!payload || !mac) return null;
  const want = Buffer.from(sign(payload));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString());
    return s.exp > Date.now() / 1000 ? s : null;
  } catch { return null; }
}

/** The signed-in, active user, or null. */
export async function currentUser(req) {
  const s = readSession(req);
  if (!s) return null;
  await ensureSchema();
  const [u] = await db()`select id, username, name, role from users where id = ${s.u} and active`;
  return u || null;
}

/* ---------- Small HTTP helpers shared by every endpoint ---------- */
export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", headers["Cache-Control"] || "no-store");
  for (const [k, v] of Object.entries(headers)) if (k !== "Cache-Control") res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

// Pages are served directly and through geckuw.com/crm/ (proxied), so writes
// may come from either origin.
const SITE_HOSTS = new Set(["geckuw.com", "www.geckuw.com"]);
const allowedHost = (host, req) => host === req.headers.host || host === req.headers["x-forwarded-host"] || SITE_HOSTS.has(host);

/**
 * Wrap a handler: maps missing configuration to a clear error, rejects
 * cross-site writes, and (unless `public`) requires a signed-in user.
 */
export function handler(fn, { auth = true, admin = false } = {}) {
  return async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.origin;
        if (origin && !allowedHost(new URL(origin).host, req)) return send(res, 403, { error: "bad_origin" });
      }
      let user = null;
      if (auth) {
        user = await currentUser(req);
        if (!user) return send(res, 401, { error: "unauthenticated" });
        if (admin && user.role !== "admin") return send(res, 403, { error: "forbidden" });
      }
      return await fn(req, res, user);
    } catch (e) {
      if (e instanceof NoDatabaseError || e.code === "no_database") return send(res, 503, { error: "no_database", envSeen: dbEnvNames() });
      if (["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "CONNECT_TIMEOUT", "28P01", "3D000", "XX000"].includes(e.code)) {
        console.error("database connection failed", e.code, e.message);
        return send(res, 503, { error: "db_connect", code: e.code });
      }
      if (e.code === "no_secret") return send(res, 503, { error: "no_secret" });
      console.error(e);
      return send(res, 500, { error: "server_error" });
    }
  };
}
