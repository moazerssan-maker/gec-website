import { db, ensureSchema } from "../_lib/db.js";
import { handler, send, body, hashPassword } from "../_lib/session.js";

const normUser = (u) => String(u || "").trim().toLowerCase();
const validUser = (u) => /^[\p{L}\p{N}._-]{2,40}$/u.test(u);
const validPass = (p) => typeof p === "string" && p.length >= 8 && p.length <= 200;

/**
 * Admin only.
 * GET  /api/users                                   -> list
 * POST {action:"create", name, username, password, role}
 * POST {action:"password", id, password}             -> reset someone's password
 * POST {action:"active", id, active}                 -> enable / disable an account
 * POST {action:"role", id, role}
 */
export default handler(async (req, res, me) => {
  await ensureSchema();
  const sql = db();
  if (req.method === "GET") {
    const users = await sql`select id, username, name, role, active, created_at from users order by id`;
    return send(res, 200, { users });
  }
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  const b = body(req);
  const id = Number(b.id);

  const lastAdminGuard = async () => {
    const [{ n }] = await sql`select count(*)::int as n from users where role = 'admin' and active and id <> ${id}`;
    return n > 0;
  };

  switch (b.action) {
    case "create": {
      const username = normUser(b.username), name = String(b.name || "").trim().slice(0, 80);
      const role = b.role === "admin" ? "admin" : "member";
      if (!validUser(username) || !name || !validPass(b.password)) return send(res, 400, { error: "invalid" });
      const rows = await sql`
        insert into users (username, name, pass_hash, role) values (${username}, ${name}, ${hashPassword(b.password)}, ${role})
        on conflict (username) do nothing returning id`;
      if (!rows.length) return send(res, 409, { error: "username_taken" });
      return send(res, 200, { ok: true, id: rows[0].id });
    }
    case "password":
      if (!validPass(b.password)) return send(res, 400, { error: "invalid" });
      await sql`update users set pass_hash = ${hashPassword(b.password)} where id = ${id}`;
      return send(res, 200, { ok: true });
    case "active":
      if (id === me.id) return send(res, 400, { error: "self" });
      if (!b.active && !(await lastAdminGuard())) return send(res, 400, { error: "last_admin" });
      await sql`update users set active = ${!!b.active} where id = ${id}`;
      return send(res, 200, { ok: true });
    case "role":
      if (id === me.id) return send(res, 400, { error: "self" });
      if (b.role !== "admin" && !(await lastAdminGuard())) return send(res, 400, { error: "last_admin" });
      await sql`update users set role = ${b.role === "admin" ? "admin" : "member"} where id = ${id}`;
      return send(res, 200, { ok: true });
    default:
      return send(res, 400, { error: "unknown_action" });
  }
}, { admin: true });
