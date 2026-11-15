import { db, ensureSchema } from "./_lib/db.js";
import { handler, send } from "./_lib/session.js";
import { PUBLIC_ID_RE, publicCard } from "./_lib/cards.js";

/**
 * GET /api/card?id=<publicId> — the only public read path.
 * Hidden cards return 404, and private contact fields are stripped server-side.
 */
export default handler(async (req, res) => {
  if (req.method !== "GET") return send(res, 405, { error: "method" });
  const url = new URL(req.url, "http://x");
  const id = String(url.searchParams.get("id") || "");
  if (!PUBLIC_ID_RE.test(id)) return send(res, 400, { error: "bad_id" });

  await ensureSchema();
  const [row] = await db()`
    select * from employees where public_id = ${id} and visible = true limit 1`;
  if (!row) return send(res, 404, { error: "not_found" });

  return send(res, 200, { card: publicCard(row) }, {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  });
}, { auth: false });
