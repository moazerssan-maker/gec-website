import crypto from "node:crypto";
import { db, ensureSchema } from "../_lib/db.js";
import { handler, send, body, currentUser, sessionCookie, clearCookie, hashPassword, verifyPassword } from "../_lib/session.js";

const normUser = (u) => String(u || "").trim().toLowerCase();
const validUser = (u) => /^[\p{L}\p{N}._-]{2,40}$/u.test(u);
const validPass = (p) => typeof p === "string" && p.length >= 8 && p.length <= 200;
const sameText = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export default handler(async (req, res) => {
  await ensureSchema();
  const sql = db();

  if (req.method === "GET") {
    const [{ n }] = await sql`select count(*)::int as n from users`;
    if (n === 0) return send(res, 200, { needsSetup: true });
    const user = await currentUser(req);
    return user ? send(res, 200, { user }) : send(res, 401, { error: "unauthenticated" });
  }
  if (req.method !== "POST") return send(res, 405, { error: "method" });

  const b = body(req);
  switch (b.action) {
    case "login": {
      const [u] = await sql`select id, pass_hash from users where username = ${normUser(b.username)} and active`;
      if (!u || !verifyPassword(b.password || "", u.pass_hash)) {
        await new Promise((r) => setTimeout(r, 600));
        return send(res, 401, { error: "bad_login" });
      }
      return send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(u.id, req) });
    }
    case "logout":
      return send(res, 200, { ok: true }, { "Set-Cookie": clearCookie() });
    case "setup": {
      // First admin only: needs the one-time SETUP_CODE and an empty users table.
      const code = (process.env.SETUP_CODE || "").trim();
      if (!code) return send(res, 403, { error: "no_setup_code" });
      if (!sameText(String(b.code || "").trim().toUpperCase(), code.toUpperCase())) return send(res, 403, { error: "bad_code" });
      const username = normUser(b.username), name = String(b.name || "").trim().slice(0, 80);
      if (!validUser(username) || !name || !validPass(b.password)) return send(res, 400, { error: "invalid" });
      const rows = await sql`
        insert into users (username, name, pass_hash, role)
        select ${username}, ${name}, ${hashPassword(b.password)}, 'admin'
        where not exists (select 1 from users)
        returning id`;
      if (!rows.length) return send(res, 409, { error: "already_setup" });
      return send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(rows[0].id, req) });
    }
    case "password": {
      const user = await currentUser(req);
      if (!user) return send(res, 401, { error: "unauthenticated" });
      const [u] = await sql`select pass_hash from users where id = ${user.id}`;
      if (!verifyPassword(b.current || "", u.pass_hash)) return send(res, 403, { error: "bad_password" });
      if (!validPass(b.next)) return send(res, 400, { error: "invalid" });
      await sql`update users set pass_hash = ${hashPassword(b.next)} where id = ${user.id}`;
      return send(res, 200, { ok: true });
    }
    default:
      return send(res, 400, { error: "unknown_action" });
  }
}, { auth: false });
