// Shared, pure logic: statuses, Kuwait working-day scheduling and how each
// call outcome changes an establishment's tracking document.
// Imported by the browser (public/app.js) and by the API (api/log.js), so the
// server is the single place that writes, using exactly these rules.

export const STATUS = {
  new: { ar: "لم يتم التواصل", c: "--st-new" },
  no_answer: { ar: "لا يرد", c: "--st-noans" },
  called: { ar: "تم الاتصال", c: "--st-called" },
  info_sent: { ar: "تم إرسال تعريف", c: "--st-info" },
  meeting: { ar: "اجتماع/زيارة", c: "--st-meet" },
  quoted: { ar: "عرض سعر مُرسل", c: "--st-quote" },
  won: { ar: "عميل", c: "--st-won" },
  lost: { ar: "غير مهتم", c: "--st-lost" },
  invalid: { ar: "بيانات غير صحيحة/مغلقة", c: "--st-invalid" },
};
export const STATUS_ORDER = ["new", "no_answer", "called", "info_sent", "meeting", "quoted", "won", "lost", "invalid"];
export const CLOSED = new Set(["won", "lost", "invalid"]);

export const OUTCOMES = [
  { k: "no_answer", ar: "لا يرد", key: "1" },
  { k: "interested", ar: "مهتم – أرسل تعريف", key: "2" },
  { k: "callback", ar: "اتصل لاحقاً", key: "3", needs: "when" },
  { k: "meeting", ar: "موعد زيارة", key: "4", needs: "when" },
  { k: "not_interested", ar: "غير مهتم", key: "5", needs: "reason" },
  { k: "wrong_number", ar: "رقم خاطئ/مغلق", key: "6" },
  { k: "gatekeeper", ar: "سكرتارية – خذ اسم المسؤول", key: "7", needs: "contact" },
  { k: "quoted", ar: "أرسلت عرض سعر", key: "8" },
  { k: "won", ar: "تم التعاقد – عميل", key: "9" },
  { k: "note", ar: "ملاحظة فقط", key: "n" },
];
export const OUTCOME_KEYS = new Set([...OUTCOMES.map((o) => o.k), "email_sent"]);
export const OUT_AR = {
  ...Object.fromEntries(OUTCOMES.map((o) => [o.k, o.ar])),
  email_sent: "إرسال بريد",
  status: "تعديل يدوي",
  contact: "تحديث بيانات المسؤول",
};
export const CHANNELS = { call: "اتصال", whatsapp: "واتساب", email: "بريد", visit: "زيارة" };

/* ---------- Kuwait time: UTC+3, no DST. Working week Sun–Thu, 08:30–16:30. ---------- */
const KW = 3 * 3600e3;
export const kwParts = (d) => {
  const x = new Date(d.getTime() + KW);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate(), wd: x.getUTCDay(), h: x.getUTCHours(), mi: x.getUTCMinutes() };
};
export const kwDate = (y, m, d, h = 0, mi = 0) => new Date(Date.UTC(y, m, d, h, mi) - KW);
export const isWorkDay = (wd) => wd >= 0 && wd <= 4;

/** n working days after `from` (Kuwait calendar), at h:mi Kuwait time. */
export function addWorkingDays(from, n, h = 9, mi = 0) {
  let p = kwParts(from);
  let dt = kwDate(p.y, p.m, p.d, 12);
  let left = n;
  while (left > 0) {
    dt = new Date(dt.getTime() + 864e5);
    if (isWorkDay(kwParts(dt).wd)) left--;
  }
  p = kwParts(dt);
  return kwDate(p.y, p.m, p.d, h, mi);
}

/** Move a time into working hours: weekend or after 16:30 -> next working day 09:00; before 08:30 -> 08:30. */
export function snapToWorking(d) {
  const p = kwParts(d);
  const mins = p.h * 60 + p.mi;
  if (isWorkDay(p.wd) && mins >= 510 && mins <= 990) return d;
  if (isWorkDay(p.wd) && mins < 510) return kwDate(p.y, p.m, p.d, 8, 30);
  return addWorkingDays(kwDate(p.y, p.m, p.d, 12), 1, 9, 0);
}
export const startOfTodayKw = (now = new Date()) => { const p = kwParts(now); return kwDate(p.y, p.m, p.d, 0, 0); };
export const endOfTodayKw = (now = new Date()) => { const p = kwParts(now); return kwDate(p.y, p.m, p.d, 23, 59); };

export const emptyDoc = () => ({ status: "new", attempts: 0, next: null, contact: {}, dnc: false, hist: [] });
const clone = (cur) => {
  const d = JSON.parse(JSON.stringify(cur || emptyDoc()));
  d.contact = d.contact || {};
  d.hist = d.hist || [];
  d.attempts = d.attempts || 0;
  d.status = d.status || "new";
  return d;
};
const fmtKw = (d) => {
  const p = kwParts(d), z = (n) => String(n).padStart(2, "0");
  return `${p.y}-${z(p.m + 1)}-${z(p.d)} ${z(p.h)}:${z(p.mi)}`;
};
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k]).map((k) => [k, String(o[k]).trim().slice(0, 200)]));

/**
 * Apply one logged outcome. Pure: returns a new document.
 * inp: {ch, summary, when (Date), reason, contact, subject, by:{id,name}}
 */
export function applyOutcome(cur, o, inp = {}, now = new Date()) {
  const d = clone(cur);
  const e = { t: now.toISOString(), ch: inp.ch || "call", o, s: String(inp.summary || "").trim().slice(0, 4000) };
  if (inp.by) { e.by = inp.by.name; e.byId = inp.by.id; }
  switch (o) {
    case "no_answer":
      d.attempts += 1;
      if (d.attempts >= 3) { d.status = "lost"; d.next = null; d.reason = "unreachable"; e.x = "بعد 3 محاولات بدون رد — أُغلقت"; }
      else { d.status = "no_answer"; d.next = addWorkingDays(now, 2).toISOString(); e.x = `المحاولة ${d.attempts} من 3`; }
      break;
    case "interested":
      d.status = "info_sent"; d.attempts = 0; d.next = addWorkingDays(now, 5).toISOString();
      break;
    case "callback":
      if (["new", "no_answer"].includes(d.status)) d.status = "called";
      d.attempts = 0; d.next = snapToWorking(inp.when).toISOString();
      break;
    case "meeting":
      d.status = "meeting"; d.attempts = 0; d.next = snapToWorking(inp.when).toISOString();
      break;
    case "quoted":
      d.status = "quoted"; d.next = addWorkingDays(now, 7).toISOString();
      break;
    case "won":
      d.status = "won"; d.next = null;
      break;
    case "not_interested":
      d.status = "lost"; d.next = null; d.reason = String(inp.reason || "").slice(0, 300);
      if (d.reason) e.x = "السبب: " + d.reason;
      break;
    case "wrong_number":
      d.status = "invalid"; d.next = null;
      break;
    case "gatekeeper":
      d.contact = { ...d.contact, ...pick(inp.contact, ["name", "role", "mobile"]) };
      if (["new", "no_answer"].includes(d.status)) d.status = "called";
      d.attempts = 0; d.next = addWorkingDays(now, 1).toISOString();
      e.x = [d.contact.name, d.contact.role, d.contact.mobile].filter(Boolean).join(" · ");
      break;
    case "email_sent":
      e.ch = "email";
      if (["new", "no_answer", "called"].includes(d.status)) d.status = "info_sent";
      if (!["meeting", "won", "lost", "invalid"].includes(d.status)) d.next = addWorkingDays(now, 7).toISOString();
      e.x = inp.subject ? "العنوان: " + String(inp.subject).slice(0, 200) : "";
      break;
    case "note":
      break;
    default:
      throw new Error("unknown outcome " + o);
  }
  if (d.next && (o === "callback" || o === "meeting")) e.x = "الموعد: " + fmtKw(new Date(d.next));
  e.st = d.status;
  d.hist.push(e);
  if (o !== "note") d.lastAt = e.t;
  d.updatedAt = e.t;
  return d;
}

/** Replace the contact person fields. */
export function applyContact(cur, contact, by, now = new Date()) {
  const d = clone(cur);
  d.contact = pick(contact, ["name", "role", "mobile", "email"]);
  const e = { t: now.toISOString(), ch: "call", o: "contact", s: "", st: d.status,
    x: [d.contact.name, d.contact.role, d.contact.mobile, d.contact.email].filter(Boolean).join(" · ") };
  if (by) { e.by = by.name; e.byId = by.id; }
  d.hist.push(e);
  d.updatedAt = e.t;
  return d;
}

/** Manual status / next-action / do-not-contact edit. `next` is a Date or null. */
export function applyManual(cur, { status, next, dnc }, by, now = new Date()) {
  const d = clone(cur);
  if (!STATUS[status]) throw new Error("bad status");
  d.status = status;
  d.next = CLOSED.has(status) || !next ? null : snapToWorking(next).toISOString();
  const dncChanged = typeof dnc === "boolean" && dnc !== !!d.dnc;
  if (typeof dnc === "boolean") d.dnc = dnc;
  const parts = [];
  if (d.next) parts.push("الموعد: " + fmtKw(new Date(d.next)));
  if (dncChanged) parts.push(d.dnc ? "طلبوا عدم التواصل" : "أُلغي «عدم التواصل»");
  const e = { t: now.toISOString(), ch: "call", o: "status", s: "", st: d.status, x: parts.join(" — ") };
  if (by) { e.by = by.name; e.byId = by.id; }
  d.hist.push(e);
  d.updatedAt = e.t;
  return d;
}
