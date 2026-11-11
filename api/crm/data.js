import { db, ensureSchema } from "../_lib/db.js";
import { handler, send } from "../_lib/session.js";
import { directory } from "../_lib/directory.js";

/**
 * GET /api/data?part=leads          -> the static establishment directory
 * GET /api/data?since=<iso>          -> tracking docs changed after `since` (all when omitted)
 */
export default handler(async (req, res) => {
  if (req.method !== "GET") return send(res, 405, { error: "method" });
  const url = new URL(req.url, "http://x");
  if (url.searchParams.get("part") === "leads") {
    return send(res, 200, (await directory()).data, { "Cache-Control": "private, max-age=3600" });
  }
  await ensureSchema();
  const sql = db();
  const since = url.searchParams.get("since");
  const sinceDate = since && !Number.isNaN(Date.parse(since)) ? new Date(since) : null;
  const rows = sinceDate
    ? await sql`select lead_id, doc, updated_at from tracking where updated_at > ${sinceDate} order by updated_at`
    : await sql`select lead_id, doc, updated_at from tracking order by updated_at`;
  const [{ now }] = await sql`select now() as now`;
  return send(res, 200, {
    now: new Date(now).toISOString(),
    rows: rows.map((r) => ({ id: r.lead_id, doc: r.doc, at: new Date(r.updated_at).toISOString() })),
  });
});
