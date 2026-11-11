import { db, ensureSchema } from "../_lib/db.js";
import { handler, send, body } from "../_lib/session.js";
import { directory } from "../_lib/directory.js";
import { applyOutcome, applyContact, applyManual, OUTCOME_KEYS, CHANNELS, STATUS } from "../../crm/logic.js";
const date = (v) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null);

/**
 * POST /api/log — every write to an establishment goes through here.
 * The row is locked while the change is applied, so two people logging the
 * same establishment at once never overwrite each other's entries.
 *   {lead_id, kind:"outcome", o, ch, summary, when, reason, contact, subject}
 *   {lead_id, kind:"contact", contact:{name, role, mobile, email}}
 *   {lead_id, kind:"manual", status, next, dnc}
 */
export default handler(async (req, res, user) => {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  const b = body(req);
  const id = Number(b.lead_id);
  if (!(await directory()).ids.has(id)) return send(res, 400, { error: "bad_lead" });

  const by = { id: user.id, name: user.name };
  let change;
  if (b.kind === "outcome") {
    if (!OUTCOME_KEYS.has(b.o)) return send(res, 400, { error: "bad_outcome" });
    const when = date(b.when);
    if ((b.o === "callback" || b.o === "meeting") && !when) return send(res, 400, { error: "need_when" });
    if (b.o === "note" && !String(b.summary || "").trim()) return send(res, 400, { error: "need_summary" });
    const ch = CHANNELS[b.ch] ? b.ch : "call";
    change = (cur) => applyOutcome(cur, b.o, { ch, summary: b.summary, when, reason: b.reason, contact: b.contact, subject: b.subject, by });
  } else if (b.kind === "contact") {
    change = (cur) => applyContact(cur, b.contact || {}, by);
  } else if (b.kind === "manual") {
    if (!STATUS[b.status]) return send(res, 400, { error: "bad_status" });
    change = (cur) => applyManual(cur, { status: b.status, next: date(b.next), dnc: typeof b.dnc === "boolean" ? b.dnc : undefined }, by);
  } else {
    return send(res, 400, { error: "bad_kind" });
  }

  await ensureSchema();
  const result = await db().begin(async (sql) => {
    await sql`insert into tracking (lead_id, doc) values (${id}, ${sql.json({ status: "new", attempts: 0, next: null, contact: {}, hist: [] })}) on conflict (lead_id) do nothing`;
    const [row] = await sql`select doc from tracking where lead_id = ${id} for update`;
    const doc = change(row.doc);
    const [saved] = await sql`
      update tracking set doc = ${sql.json(doc)}, updated_at = now(), updated_by = ${user.id}
      where lead_id = ${id} returning doc, updated_at`;
    return saved;
  });
  return send(res, 200, { id, doc: result.doc, at: new Date(result.updated_at).toISOString() });
});
