import {
  STATUS, STATUS_ORDER, CLOSED, OUTCOMES, OUT_AR, CHANNELS,
  kwParts, kwDate, addWorkingDays, snapToWorking, startOfTodayKw, endOfTodayKw, emptyDoc,
} from "./logic.js";
import { buildEmail, STEPS, tier, TIER_AR } from "./email.js";

/* ---------- Constants ---------- */
const PRIO = { "عالية": { c: "--p-high", r: 0 }, "متوسطة": { c: "--p-med", r: 1 }, "منخفضة": { c: "--p-low", r: 2 } };
const ERR_AR = {
  no_database: "قاعدة البيانات غير مربوطة بعد. اربط قاعدة Postgres بالمشروع من لوحة Vercel ثم أعد النشر.",
  db_connect: "تعذّر الاتصال بقاعدة البيانات. تحقق من رابط الاتصال في إعدادات Vercel.",
  no_secret: "إعداد AUTH_SECRET ناقص في Vercel.",
  bad_login: "اسم المستخدم أو كلمة المرور غير صحيحة.",
  bad_code: "رمز الإعداد غير صحيح.",
  no_setup_code: "رمز الإعداد غير مضاف في إعدادات Vercel (SETUP_CODE).",
  invalid: "تحقق من البيانات: اسم المستخدم بدون مسافات، وكلمة المرور 8 أحرف على الأقل.",
  username_taken: "اسم المستخدم مستخدم من قبل.",
  bad_password: "كلمة المرور الحالية غير صحيحة.",
  last_admin: "لا يمكن إيقاف آخر مدير.",
  self: "لا يمكنك تعديل حسابك من هنا.",
  already_setup: "تم إنشاء المدير مسبقاً. سجّل الدخول.",
  server_error: "حدث خطأ في الخادم. حاول مرة أخرى.",
  network: "تعذّر الاتصال بالخادم. تحقق من الإنترنت.",
};

/* ---------- Kuwait date formatting ---------- */
const fmtFull = new Intl.DateTimeFormat("ar-KW-u-nu-latn", { timeZone: "Asia/Kuwait", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false });
const fmtDay = new Intl.DateTimeFormat("ar-KW-u-nu-latn", { timeZone: "Asia/Kuwait", weekday: "short", day: "numeric", month: "short" });
const fmtTime = new Intl.DateTimeFormat("ar-KW-u-nu-latn", { timeZone: "Asia/Kuwait", hour: "2-digit", minute: "2-digit", hour12: false });
function fmtRel(iso) {
  if (!iso) return "—";
  const d = new Date(iso), dayDiff = Math.floor((d.getTime() - startOfTodayKw().getTime()) / 864e5);
  if (dayDiff === 0) return "اليوم " + fmtTime.format(d);
  if (dayDiff === 1) return "غداً " + fmtTime.format(d);
  if (dayDiff === -1) return "أمس " + fmtTime.format(d);
  return fmtDay.format(d) + " " + fmtTime.format(d);
}
const toLocalInput = (d) => { const p = kwParts(d), z = (n) => String(n).padStart(2, "0"); return `${p.y}-${z(p.m + 1)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`; };
const fromLocalInput = (v) => { const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(v || ""); return m ? kwDate(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null; };

/* ---------- Arabic-aware search ---------- */
function norm(s) {
  return String(s || "").toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/\s+/g, " ").trim();
}

/* ---------- Helpers ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const chipStatus = (st) => { const s = STATUS[st] || STATUS.new; return `<span class="chip" style="--c:var(${s.c})">${s.ar}</span>`; };
const chipPrio = (p) => (p ? `<span class="chip" style="--c:var(${(PRIO[p] || PRIO["منخفضة"]).c})">أولوية ${esc(p)}</span>` : "");
function toast(msg) { const r = $("#toastRoot"); r.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => (r.innerHTML = ""), 3600); }
async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); toast("تم النسخ"); }
  catch {
    const el = btn && btn.closest("[data-copy-wrap]")?.querySelector("[data-copy-src]");
    if (el) { if (el.select) el.select(); else { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } }
    toast("حدّد النص وانسخه يدوياً");
  }
}
const isMobileKw = (n) => /^[569]\d{7}$/.test(n);
const errText = (e) => ERR_AR[e?.error || e] || ERR_AR.server_error;

async function api(path, opts = {}) {
  let r;
  try {
    r = await fetch(path, { credentials: "same-origin", headers: opts.body ? { "Content-Type": "application/json" } : {}, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  } catch { throw { error: "network", status: 0 }; }
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw { ...data, status: r.status };
  return data;
}

/* ---------- State ---------- */
const S = {
  me: null, sectors: [], sectorBy: {}, leads: [], byId: new Map(),
  track: new Map(), since: null, route: { name: "home" }, filt: {}, q: "",
  openId: null, sel: null, mailStep: "intro", busy: false, users: [],
};
const T = (id) => S.track.get(id) || emptyDoc();
const isDue = (t, until = endOfTodayKw()) => t.next && !CLOSED.has(t.status) && new Date(t.next) <= until;
const phonesOf = (l) => [...l.office.map((n) => ({ n, k: "مكتب" })), ...l.factory.map((n) => ({ n, k: "مصنع" }))];
function setConn(s, label) { const c = $("#conn"); c.dataset.s = s; c.lastElementChild.textContent = label; }

/* ---------- Auth screens ---------- */
function authScreen(kind, msg = "") {
  $("#appRoot").hidden = true;
  const setup = kind === "setup";
  $("#authRoot").innerHTML = `<div class="auth"><form id="authForm" autocomplete="on">
    <img class="logo" src="/gec-logo.png" alt="البيئة الخضراء">
    <h1>دخول الموظفين</h1>
    <p>${setup ? "أول دخول: أنشئ حساب المدير. ستحتاج رمز الإعداد (SETUP_CODE) الموجود في إعدادات المشروع على Vercel." : "سجّل الدخول للمتابعة."}</p>
    ${setup ? `<label class="fld">رمز الإعداد<input id="aCode" required autocomplete="off"></label>
      <label class="fld">اسمك (يظهر في السجل وفي توقيع البريد)<input id="aName" required></label>` : ""}
    <label class="fld">اسم المستخدم<input id="aUser" required autocomplete="username" autocapitalize="none" dir="ltr"></label>
    <label class="fld">كلمة المرور<input id="aPass" type="password" required autocomplete="${setup ? "new-password" : "current-password"}" minlength="${setup ? 8 : 1}" dir="ltr"></label>
    <div class="err" id="aErr">${esc(msg)}</div>
    <button class="btn primary" type="submit">${setup ? "إنشاء حساب المدير" : "دخول"}</button>
    <a class="back" href="/ar/index.html">العودة إلى موقع البيئة الخضراء</a>
  </form></div>`;
  $("#authForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button"); btn.disabled = true; $("#aErr").textContent = "";
    try {
      await api("api/auth", { method: "POST", body: setup
        ? { action: "setup", code: $("#aCode").value.trim(), name: $("#aName").value, username: $("#aUser").value, password: $("#aPass").value }
        : { action: "login", username: $("#aUser").value, password: $("#aPass").value } });
      boot();
    } catch (err) { $("#aErr").textContent = errText(err); btn.disabled = false; }
  };
}

async function boot() {
  let me;
  try { me = await api("api/auth"); }
  catch (e) {
    if (e.status === 401) return authScreen("login");
    $("#authRoot").innerHTML = `<div class="auth"><form><img class="logo" src="/gec-logo.png" alt="البيئة الخضراء"><h1>دخول الموظفين</h1><p class="err">${esc(errText(e))}</p></form></div>`;
    return;
  }
  if (me.needsSetup) return authScreen("setup");
  S.me = me.user;
  $("#authRoot").innerHTML = "";
  $("#appRoot").hidden = false;
  $("#userName").textContent = S.me.name;
  $("#userRole").textContent = `${S.me.username} · ${S.me.role === "admin" ? "مدير" : "موظف"}`;
  $("#menuUsers").hidden = S.me.role !== "admin";
  try {
    const d = await api("api/data?part=leads");
    S.sectors = d.sectors; S.leads = d.leads; S.sectorBy = {}; S.byId = new Map();
    d.sectors.forEach((s) => (S.sectorBy[s.code] = s));
    d.leads.forEach((l) => S.byId.set(l.id, l));
    await sync(true);
    go();
    startPolling();
  } catch (e) {
    if (e.status === 401) return authScreen("login");
    $("#view").innerHTML = `<div class="empty">${esc(errText(e))}</div>`;
  }
}

/* ---------- Sync: full load once, then only changed rows every 30 s ---------- */
async function sync(full = false) {
  try {
    const d = await api("api/data" + (!full && S.since ? "?since=" + encodeURIComponent(S.since) : ""));
    if (full) S.track = new Map();
    d.rows.forEach((r) => S.track.set(r.id, r.doc));
    S.since = d.now;
    setConn("live", "متزامن");
    if (!full && d.rows.length) refresh();
  } catch (e) {
    if (e.status === 401) { stopPolling(); return authScreen("login", "انتهت الجلسة، سجّل الدخول مرة أخرى."); }
    setConn("off", e.error === "network" ? "غير متصل" : "خطأ في المزامنة");
    if (full) throw e;
  }
}
let pollTimer = null;
function startPolling() { stopPolling(); pollTimer = setInterval(() => { if (!document.hidden) sync(); }, 30000); }
function stopPolling() { clearInterval(pollTimer); pollTimer = null; }
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.me && S.leads.length) sync(); });

async function write(payload) {
  try {
    const r = await api("api/log", { method: "POST", body: payload });
    S.track.set(r.id, r.doc);
    refresh();
    return r.doc;
  } catch (e) {
    if (e.status === 401) { authScreen("login", "انتهت الجلسة، سجّل الدخول مرة أخرى."); return null; }
    toast("لم يُحفظ: " + errText(e));
    return null;
  }
}

/* ---------- Routing ---------- */
function parseRoute() {
  const h = location.hash.replace(/^#/, "");
  if (["today", "search", "users", "account"].includes(h)) return { name: h };
  const m = /^s-(\d{2})$/.exec(h);
  if (m && S.sectorBy[m[1]]) return { name: "sector", code: m[1] };
  return { name: "home" };
}
function go() {
  if (!S.me || !S.leads.length) return;
  S.route = parseRoute();
  if (S.route.name === "users" && S.me.role !== "admin") S.route = { name: "home" };
  const n = S.route.name;
  $("#navHome").toggleAttribute("aria-current", n === "home" || n === "sector");
  if (n === "home" || n === "sector") $("#navHome").setAttribute("aria-current", "page");
  if (n === "today") $("#navToday").setAttribute("aria-current", "page"); else $("#navToday").removeAttribute("aria-current");
  const v = $("#view");
  if (n === "home") v.innerHTML = homeSkeleton();
  else if (n === "today") v.innerHTML = todaySkeleton();
  else if (n === "search") v.innerHTML = searchSkeleton();
  else if (n === "users") { v.innerHTML = usersSkeleton(); bindUsers(); loadUsers(); }
  else if (n === "account") { v.innerHTML = accountSkeleton(); bindAccount(); }
  else { v.innerHTML = sectorSkeleton(S.route.code); bindSector(S.route.code); }
  closeMenu();
  refresh();
  window.scrollTo(0, 0);
}
function refresh() {
  if (!S.leads.length) return;
  const due = S.leads.filter((l) => isDue(T(l.id))).length;
  const b = $("#dueBadge"); b.textContent = due; b.hidden = !due;
  const r = S.route.name;
  if (r === "home") updateHome(); else if (r === "today") updateToday(); else if (r === "search") updateSearch(); else if (r === "sector") updateSector();
  if (S.openId != null) updateDrawerLive();
}

/* ---------- Home: every sector is its own tile ---------- */
function homeSkeleton() {
  return `<div class="sector-head"><div><h1>القطاعات الصناعية</h1><p class="muted" style="margin:4px 0 0">كل قطاع (قسم ISIC) في صفحة مستقلة. اختر قطاعاً لعرض منشآته فقط.</p></div></div>
  <section class="block" style="margin-top:18px"><div class="funnel" id="funnel"></div></section>
  <section class="block"><div class="head"><h2>القطاعات</h2><div class="legend" id="legend"></div></div><div class="board" id="board"></div></section>
  <section class="block"><div class="head"><h2>آخر ما تم</h2><a href="#today">مواعيد اليوم ←</a></div><div id="feed"></div></section>`;
}
function statusCounts(list) { const c = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])); list.forEach((l) => c[T(l.id).status]++); return c; }
function barHtml(c, total) { return `<div class="bar" aria-hidden="true">${STATUS_ORDER.filter((s) => s !== "new" && c[s]).map((s) => `<i style="width:${((c[s] / total) * 100).toFixed(2)}%;background:var(${STATUS[s].c})"></i>`).join("")}</div>`; }
function updateHome() {
  const c = statusCounts(S.leads), total = S.leads.length;
  const due = S.leads.filter((l) => isDue(T(l.id))).length;
  $("#funnel").innerHTML = [
    ["إجمالي المنشآت", total], ["لم يتم التواصل", c.new], ["تم التواصل", total - c.new], ["أُرسل تعريف", c.info_sent],
    ["اجتماع/زيارة", c.meeting], ["عرض سعر", c.quoted], ["عملاء", c.won],
  ].map(([k, v]) => `<div><span>${k}</span><b class="num">${v}</b></div>`).join("") + `<div class="k-due"><span>مستحق اليوم</span><b class="num">${due}</b></div>`;
  $("#legend").innerHTML = STATUS_ORDER.filter((s) => s !== "new").map((s) => `<span style="--c:var(${STATUS[s].c})">${STATUS[s].ar}</span>`).join("");
  $("#board").innerHTML = S.sectors.map((s) => {
    const list = S.leads.filter((l) => l.div === s.code), sc = statusCounts(list);
    const hi = list.filter((l) => l.prio === "عالية").length;
    const d = list.filter((l) => isDue(T(l.id))).length;
    return `<a class="tile" href="#s-${s.code}"><span class="code">ISIC ${s.code} · ${TIER_AR[tier(s.code)]}</span><h3>${esc(s.name)}</h3>
      <div class="meta"><span><b class="num">${list.length}</b> منشأة</span><span><b class="num">${hi}</b> أولوية عالية</span><span>تم التواصل <b class="num">${list.length - sc.new}</b></span>${d ? `<span style="color:var(--p-high)">مستحق <b class="num" style="color:inherit">${d}</b></span>` : ""}</div>
      ${barHtml(sc, list.length)}</a>`;
  }).join("");
  const ev = [];
  S.track.forEach((t, id) => (t.hist || []).forEach((h) => ev.push({ id, h })));
  ev.sort((a, b) => b.h.t.localeCompare(a.h.t));
  $("#feed").innerHTML = ev.length
    ? `<div class="feed">${ev.slice(0, 15).map(({ id, h }) => {
        const l = S.byId.get(id); if (!l) return "";
        return `<button type="button" data-open="${id}">
          <span><b>${esc(l.name)}</b> <span class="muted">· ISIC ${l.div}</span> — ${esc(OUT_AR[h.o] || h.o)}${h.by ? ` <span class="muted">· ${esc(h.by)}</span>` : ""}</span><span class="t">${fmtRel(h.t)}</span>
          ${h.s || h.x ? `<span class="s">${esc([h.x, h.s].filter(Boolean).join(" — "))}</span>` : ""}</button>`;
      }).join("")}</div>`
    : `<div class="empty">لم يُسجَّل أي تواصل بعد. افتح قطاعاً، اختر منشأة، وسجّل نتيجة أول اتصال وستظهر هنا.</div>`;
}

/* ---------- Sector page ---------- */
function sectorSkeleton(code) {
  const s = S.sectorBy[code];
  const f = S.filt[code] || (S.filt[code] = { grp: "all", q: "", st: "open", area: "", prio: "", has: "" });
  const list = S.leads.filter((l) => l.div === code);
  const areas = [...new Set(list.map((l) => l.area).filter(Boolean))].sort();
  const areaAr = (a) => list.find((l) => l.area === a).areaAr;
  return `<div class="crumb"><a href="#home">القطاعات</a> / ISIC ${code} · ${TIER_AR[tier(code)]}</div>
  <div class="sector-head"><div style="min-width:0"><h1>${esc(s.name)}</h1>
    <div class="sector-switch"><label class="muted" for="secSel" style="font-size:12.5px">انتقل لقطاع آخر: </label>
    <select id="secSel">${S.sectors.map((x) => `<option value="${x.code}" ${x.code === code ? "selected" : ""}>${x.code} — ${esc(x.name)}</option>`).join("")}</select></div></div>
    <div class="stats" id="secStats"></div></div>
  ${s.groups.length > 1 ? `<div class="subtabs" id="subtabs" role="group" aria-label="النشاط الفرعي">
     <button type="button" data-grp="all" aria-pressed="${f.grp === "all"}">كل الأنشطة</button>
     ${s.groups.map((g) => `<button type="button" data-grp="${g.code}" aria-pressed="${f.grp === g.code}">${g.code} · ${esc(g.name)}</button>`).join("")}</div>` : ""}
  <div class="filters">
    <input type="search" id="fQ" placeholder="بحث داخل هذا القطاع…" value="${esc(f.q)}">
    <select id="fSt" aria-label="الحالة">
      <option value="open">المفتوحة (غير مغلقة)</option><option value="all">كل الحالات</option><option value="due">مستحق اليوم</option>
      ${STATUS_ORDER.map((k) => `<option value="${k}">${STATUS[k].ar}</option>`).join("")}</select>
    <select id="fArea" aria-label="المنطقة"><option value="">كل المناطق</option>${areas.map((a) => `<option value="${esc(a)}">${esc(areaAr(a))}</option>`).join("")}<option value="-">بدون منطقة</option></select>
    <select id="fPrio" aria-label="الأولوية"><option value="">كل الأولويات</option><option>عالية</option><option>متوسطة</option><option>منخفضة</option></select>
    <select id="fHas" aria-label="بيانات التواصل"><option value="">الكل</option><option value="phone">لديها هاتف</option><option value="email">لديها بريد</option><option value="none">بدون هاتف</option></select>
  </div>
  <div class="count-line" id="countLine"></div>
  <div id="secList"></div>`;
}
function bindSector(code) {
  const f = S.filt[code];
  $("#fSt").value = f.st; $("#fArea").value = f.area; $("#fPrio").value = f.prio; $("#fHas").value = f.has;
  $("#secSel").onchange = (e) => (location.hash = "s-" + e.target.value);
  $("#fQ").oninput = (e) => { f.q = e.target.value; updateSector(); };
  [["fSt", "st"], ["fArea", "area"], ["fPrio", "prio"], ["fHas", "has"]].forEach(([id, k]) => ($("#" + id).onchange = (e) => { f[k] = e.target.value; updateSector(); }));
  const st = $("#subtabs");
  if (st) st.onclick = (e) => { const b = e.target.closest("[data-grp]"); if (!b) return; f.grp = b.dataset.grp; st.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b)); updateSector(); };
}
/* Queue order: priority (عالية first) → area → has phone → never contacted → due date. */
function queueSort(a, b) {
  const ta = T(a.id), tb = T(b.id);
  return (PRIO[a.prio]?.r ?? 3) - (PRIO[b.prio]?.r ?? 3)
    || (a.area || "ي").localeCompare(b.area || "ي")
    || (phonesOf(b).length ? 1 : 0) - (phonesOf(a).length ? 1 : 0)
    || (ta.status === "new" ? 0 : 1) - (tb.status === "new" ? 0 : 1)
    || String(ta.next || "z").localeCompare(String(tb.next || "z"))
    || a.id - b.id;
}
function matchQ(l, q) {
  if (!q) return true;
  const n = norm(q), digits = q.replace(/\D/g, "");
  if (digits.length >= 4 && [...l.office, ...l.factory, ...l.fax, T(l.id).contact?.mobile || ""].some((p) => p.includes(digits))) return true;
  const hay = norm([l.name, l.former, l.products.join(" "), l.areaAr, l.area, l.email, T(l.id).contact?.name].join(" "));
  return n.split(" ").every((w) => hay.includes(w));
}
function rowHtml(l) {
  const t = T(l.id), ph = phonesOf(l)[0], due = isDue(t);
  return `<button type="button" class="row" data-open="${l.id}">
    <span class="nm">${esc(l.name)}${l.former ? `<small>سابقاً: ${esc(l.former)}</small>` : ""}${t.contact?.name ? `<small>المسؤول: ${esc(t.contact.name)}</small>` : ""}</span>
    <span class="prod">${esc(l.products[0] || "—")}</span>
    <span class="ar">${esc(l.areaAr || "—")}</span>
    <span class="ph num">${ph ? esc(ph.n) : `<span class="muted">لا يوجد هاتف</span>`}${l.email || t.contact?.email ? " ✉" : ""}</span>
    <span class="pr">${l.prio ? `<span class="chip" style="--c:var(${PRIO[l.prio].c})">${esc(l.prio)}</span>` : ""}</span>
    <span class="st" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">${chipStatus(t.status)}${t.dnc ? `<span class="nx" style="color:var(--p-high)">لا تتواصل</span>` : ""}${t.next && !CLOSED.has(t.status) ? `<span class="nx ${due ? "due" : ""}">${due ? "مستحق · " : ""}${fmtRel(t.next)}</span>` : ""}</span>
  </button>`;
}
const ROW_HEAD = `<div class="row-h"><span>المنشأة</span><span>المنتج الرئيسي</span><span>المنطقة</span><span>الهاتف</span><span>الأولوية</span><span>الحالة / الموعد</span></div>`;
function updateSector() {
  const code = S.route.code, s = S.sectorBy[code], f = S.filt[code];
  const all = S.leads.filter((l) => l.div === code), sc = statusCounts(all);
  $("#secStats").innerHTML = `<span><b>${all.length}</b>منشأة</span><span><b>${all.length - sc.new}</b>تم التواصل</span><span><b>${sc.info_sent + sc.meeting + sc.quoted}</b>مهتمون</span><span><b>${sc.won}</b>عملاء</span>`;
  const list = all.filter((l) => {
    const t = T(l.id);
    if (f.grp !== "all" && l.grp !== f.grp) return false;
    if (f.st === "open" && CLOSED.has(t.status)) return false;
    if (f.st === "due" && !isDue(t)) return false;
    if (!["open", "all", "due"].includes(f.st) && t.status !== f.st) return false;
    if (f.area === "-" ? l.area : f.area && l.area !== f.area) return false;
    if (f.prio && l.prio !== f.prio) return false;
    if (f.has === "phone" && !phonesOf(l).length) return false;
    if (f.has === "none" && phonesOf(l).length) return false;
    if (f.has === "email" && !(l.email || t.contact?.email)) return false;
    return matchQ(l, f.q);
  }).sort(queueSort);
  $("#countLine").textContent = `يظهر ${list.length} من ${all.length}، مرتبة حسب الأولوية ثم المنطقة ثم من لم يُتصل به`;
  const groups = s.groups.filter((g) => f.grp === "all" || g.code === f.grp);
  const html = groups.map((g) => {
    const items = list.filter((l) => l.grp === g.code); if (!items.length) return "";
    return `<div class="group-h"><h3>${g.code} · ${esc(g.name)}</h3><small class="num">${items.length}</small></div><div class="rows">${ROW_HEAD}${items.map(rowHtml).join("")}</div>`;
  }).join("");
  $("#secList").innerHTML = html || `<div class="empty">لا توجد منشآت تطابق هذه الفلاتر. جرّب «كل الحالات» أو امسح البحث.</div>`;
}

/* ---------- Today: due callbacks, still grouped by sector ---------- */
function todaySkeleton() {
  return `<h1>مواعيد اليوم</h1><p class="muted" style="margin:4px 0 0">أيام العمل الأحد–الخميس، 08:30–16:30 بتوقيت الكويت. المتأخر يظهر أولاً، مقسماً حسب القطاع.</p><div id="todayList"></div>`;
}
function bySectorBlocks(list, emptyMsg) {
  if (!list.length) return `<div class="empty">${emptyMsg}</div>`;
  return S.sectors.map((s) => {
    const items = list.filter((l) => l.div === s.code); if (!items.length) return "";
    return `<div class="group-h"><h3>ISIC ${s.code} · ${esc(s.name)}</h3><small class="num">${items.length}</small></div><div class="rows">${ROW_HEAD}${items.map(rowHtml).join("")}</div>`;
  }).join("");
}
function updateToday() {
  const sod = startOfTodayKw(), eod = endOfTodayKw(), wk = addWorkingDays(new Date(), 5, 23, 59);
  const by = (a, b) => String(T(a.id).next).localeCompare(String(T(b.id).next));
  const open = S.leads.filter((l) => T(l.id).next && !CLOSED.has(T(l.id).status));
  const over = open.filter((l) => new Date(T(l.id).next) < sod).sort(by);
  const today = open.filter((l) => { const d = new Date(T(l.id).next); return d >= sod && d <= eod; }).sort(by);
  const soon = open.filter((l) => { const d = new Date(T(l.id).next); return d > eod && d <= wk; }).sort(by);
  $("#todayList").innerHTML =
    (over.length ? `<section class="block"><div class="head"><h2 style="color:var(--p-high)">متأخر (${over.length})</h2></div>${bySectorBlocks(over, "")}</section>` : "") +
    `<section class="block"><div class="head"><h2>اليوم (${today.length})</h2></div>${bySectorBlocks(today, "لا توجد مواعيد اليوم. ابدأ بقطاع من صفحة القطاعات.")}</section>` +
    `<section class="block"><div class="head"><h2>الأيام الخمسة القادمة (${soon.length})</h2></div>${bySectorBlocks(soon, "لا توجد مواعيد قادمة هذا الأسبوع.")}</section>`;
}

/* ---------- Global search: results grouped by sector ---------- */
function searchSkeleton() { return `<h1>نتائج البحث</h1><p class="muted" id="sMeta" style="margin:4px 0 0"></p><div id="sList"></div>`; }
function updateSearch() {
  const q = S.q.trim();
  const list = q ? S.leads.filter((l) => matchQ(l, q)).sort(queueSort) : [];
  $("#sMeta").textContent = q ? `«${q}»: ${list.length} نتيجة، مقسمة حسب القطاع` : "اكتب في خانة البحث أعلاه.";
  $("#sList").innerHTML = q ? bySectorBlocks(list.slice(0, 200), "لا نتائج. جرّب جزءاً من الاسم أو رقم الهاتف.") : "";
}

/* ---------- Users (admin) ---------- */
function usersSkeleton() {
  return `<h1>المستخدمون</h1><p class="muted" style="margin:4px 0 0">كل موظف يدخل باسم مستخدم وكلمة مرور خاصة به، ويظهر اسمه في سجل كل مكالمة.</p>
  <section class="block"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الصلاحية</th><th>الحالة</th><th></th></tr></thead><tbody id="uBody"><tr><td colspan="5" class="muted">جاري التحميل…</td></tr></tbody></table></div></section>
  <section class="block"><div class="head"><h2>إضافة موظف</h2></div>
    <form class="panel" id="uForm"><div class="form-grid" style="margin-top:0">
      <label>الاسم<input id="uName" required></label>
      <label>اسم المستخدم (إنجليزي بدون مسافات)<input id="uUser" required dir="ltr" autocapitalize="none" autocomplete="off"></label>
      <label>كلمة المرور (8 أحرف على الأقل)<input id="uPass" required minlength="8" dir="ltr" autocomplete="new-password"></label>
      <label>الصلاحية<select id="uRole"><option value="member">موظف</option><option value="admin">مدير (يضيف مستخدمين)</option></select></label></div>
      <div class="actions"><button class="btn primary" type="submit">إضافة</button></div></form></section>`;
}
async function loadUsers() {
  try { S.users = (await api("api/users")).users; renderUsers(); }
  catch (e) { $("#uBody").innerHTML = `<tr><td colspan="5">${esc(errText(e))}</td></tr>`; }
}
function renderUsers() {
  $("#uBody").innerHTML = S.users.map((u) => `<tr>
    <td>${esc(u.name)}${u.id === S.me.id ? ` <span class="muted">(أنت)</span>` : ""}</td><td class="num">${esc(u.username)}</td>
    <td>${u.role === "admin" ? "مدير" : "موظف"}</td><td>${u.active ? "فعّال" : `<span class="muted">موقوف</span>`}</td>
    <td style="display:flex;gap:6px">${u.id === S.me.id ? "" : `
      <button class="btn small" type="button" data-u="pass" data-id="${u.id}">كلمة مرور جديدة</button>
      <button class="btn small" type="button" data-u="active" data-id="${u.id}" data-v="${!u.active}">${u.active ? "إيقاف" : "تفعيل"}</button>`}</td></tr>
    <tr id="uPw-${u.id}" hidden><td colspan="5"><form data-pwform="${u.id}" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input type="text" minlength="8" required dir="ltr" placeholder="كلمة المرور الجديدة" autocomplete="off" style="padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg)">
      <button class="btn small primary" type="submit">حفظ</button></form></td></tr>`).join("");
}
function bindUsers() {
  $("#uForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("api/users", { method: "POST", body: { action: "create", name: $("#uName").value, username: $("#uUser").value, password: $("#uPass").value, role: $("#uRole").value } });
      toast("تمت إضافة الموظف. أرسل له الرابط واسم المستخدم وكلمة المرور.");
      e.target.reset(); loadUsers();
    } catch (err) { toast(errText(err)); }
  };
  $("#view").onclick = async (e) => {
    const b = e.target.closest("[data-u]"); if (!b) return;
    if (b.dataset.u === "pass") { const r = $("#uPw-" + b.dataset.id); r.hidden = !r.hidden; return; }
    try { await api("api/users", { method: "POST", body: { action: "active", id: +b.dataset.id, active: b.dataset.v === "true" } }); loadUsers(); }
    catch (err) { toast(errText(err)); }
  };
  $("#view").onsubmit = async (e) => {
    const f = e.target.closest("[data-pwform]"); if (!f) return;
    e.preventDefault();
    try { await api("api/users", { method: "POST", body: { action: "password", id: +f.dataset.pwform, password: f.querySelector("input").value } }); toast("تم تغيير كلمة المرور"); loadUsers(); }
    catch (err) { toast(errText(err)); }
  };
}

/* ---------- Account ---------- */
function accountSkeleton() {
  return `<h1>تغيير كلمة المرور</h1>
  <section class="block"><form class="panel" id="pwForm"><div class="form-grid" style="margin-top:0">
    <label class="full">كلمة المرور الحالية<input id="pwCur" type="password" required dir="ltr" autocomplete="current-password"></label>
    <label class="full">كلمة المرور الجديدة (8 أحرف على الأقل)<input id="pwNew" type="password" required minlength="8" dir="ltr" autocomplete="new-password"></label></div>
    <div class="actions"><button class="btn primary" type="submit">حفظ</button></div></form></section>`;
}
function bindAccount() {
  $("#pwForm").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("api/auth", { method: "POST", body: { action: "password", current: $("#pwCur").value, next: $("#pwNew").value } }); toast("تم تغيير كلمة المرور"); e.target.reset(); }
    catch (err) { toast(errText(err)); }
  };
}

/* ---------- Drawer: one establishment ---------- */
function openLead(id) {
  S.openId = id; S.sel = null; S.mailStep = defaultStep(T(id));
  const l = S.byId.get(id), s = S.sectorBy[l.div];
  const grp = s.groups.find((g) => g.code === l.grp);
  $("#drawerRoot").innerHTML = `<div class="scrim" data-close></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle">
    <div class="d-head"><div class="ttl"><h2 id="dTitle">${esc(l.name)}</h2>
      <div class="sub">ISIC ${l.div} · ${esc(s.name)}${grp ? ` — ${esc(grp.name)}` : ""}</div>
      <div class="chips" id="dChips"></div></div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end"><button class="x" type="button" data-close aria-label="إغلاق">×</button>
      <button class="btn small" type="button" id="goMail">إرسال بريد</button></div></div>
    <div class="d-body">
      <div class="card"><h3>التواصل</h3><div class="phones" id="dPhones"></div></div>
      <div class="card" id="dLog"><h3>تسجيل مكالمة / تواصل</h3>
        <div class="form-grid" style="margin-top:0"><label>الوسيلة<select id="lCh">${Object.entries(CHANNELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label></div>
        <div class="outcomes" id="lOut" style="margin-top:10px">${OUTCOMES.map((o) => `<button type="button" data-o="${o.k}" aria-pressed="false"><kbd>${o.key}</kbd>${o.ar}</button>`).join("")}</div>
        <div id="lExtra"></div>
        <div class="form-grid"><label class="full">ملخص المكالمة / ملاحظة<textarea id="lSum" placeholder="مثال: تحدثت مع مدير المصنع، تصريحهم ينتهي في مارس…"></textarea></label></div>
        <div class="hint" id="lHint">اختر نتيجة التواصل ثم احفظ. المواعيد تُضبط تلقائياً على أيام العمل.</div>
        <div class="actions"><button class="btn primary" type="button" id="lSave" disabled>حفظ</button></div>
        <div id="lAfter"></div>
      </div>
      <div class="card" id="dMail"><h3>إرسال بريد</h3><div id="mailBox"></div></div>
      <div class="card"><h3>المسؤول في المنشأة</h3>
        <div class="form-grid" style="margin-top:0">
          <label>الاسم<input id="cName"></label><label>المنصب<input id="cRole"></label>
          <label>الجوال<input id="cMob" inputmode="tel" class="num"></label><label>البريد<input id="cMail" type="email" class="num" dir="ltr"></label></div>
        <div class="actions"><button class="btn small" type="button" id="cSave">حفظ بيانات المسؤول</button></div></div>
      <div class="card"><h3>الحالة والموعد القادم</h3>
        <div class="form-grid" style="margin-top:0">
          <label>الحالة<select id="mSt">${STATUS_ORDER.map((k) => `<option value="${k}">${STATUS[k].ar}</option>`).join("")}</select></label>
          <label>الموعد القادم<input id="mNext" type="datetime-local"></label>
          <label class="check full"><input type="checkbox" id="mDnc"> طلبوا عدم التواصل معهم (لا ترسل ولا تتصل)</label></div>
        <div class="actions"><button class="btn small" type="button" id="mClear">بدون موعد</button><button class="btn small" type="button" id="mSave">حفظ التعديل</button></div></div>
      <div class="card"><h3>السجل</h3><ul class="hist" id="dHist"></ul></div>
      <div class="card"><h3>بيانات المنشأة</h3><dl class="kv" id="dInfo"></dl></div>
      <div class="card"><h3>خدمات مقترحة</h3><ul class="svc">${l.services.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    </div></aside>`;
  fillForms(T(id));
  $("#dInfo").innerHTML = [
    ["المنتجات", l.products.join("، ")], ["الطاقة المرخصة", l.capacity.join("، ")],
    ["المنطقة", l.areaAr ? `${esc(l.areaAr)} <span class="muted">(${esc(l.area)})</span>` : l.areaRaw ? esc(l.areaRaw) : "—", true],
    ["الاسم السابق", l.former], ["ص.ب", [l.pobox, l.postal].filter(Boolean).join(" — ")],
    ["الفاكس", l.fax.join(" / ")], ["جهة التمويل", l.fund], ["الدليل", `صفحة ${l.page} · تسلسل ${l.serial}`],
    ["تصنيف البريد", TIER_AR[tier(l.div)]], ["رقم السجل", String(l.id)],
  ].filter((r) => r[1]).map(([k, v, raw]) => `<dt>${k}</dt><dd>${raw ? v : esc(v)}</dd>`).join("");
  $("#goMail").onclick = () => { $("#dMail").scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(() => $("#mBody")?.focus({ preventScroll: true }), 400); };
  $("#lOut").onclick = (e) => { const b = e.target.closest("[data-o]"); if (b) pickOutcome(b.dataset.o); };
  $("#lSave").onclick = submitLog;
  $("#cSave").onclick = saveContact;
  $("#mSave").onclick = saveManual;
  $("#mClear").onclick = () => { $("#mNext").value = ""; };
  renderMail();
  updateDrawerLive();
  document.body.style.overflow = "hidden";
  setTimeout(() => $(".drawer .x")?.focus(), 0);
}
function fillForms(t) {
  $("#cName").value = t.contact?.name || ""; $("#cRole").value = t.contact?.role || ""; $("#cMob").value = t.contact?.mobile || ""; $("#cMail").value = t.contact?.email || "";
  $("#mSt").value = t.status; $("#mNext").value = t.next ? toLocalInput(new Date(t.next)) : ""; $("#mDnc").checked = !!t.dnc;
}
function closeDrawer() { S.openId = null; $("#drawerRoot").innerHTML = ""; document.body.style.overflow = ""; }
function updateDrawerLive() {
  const l = S.byId.get(S.openId); if (!l || !$("#dChips")) return;
  const t = T(l.id);
  $("#dChips").innerHTML = chipPrio(l.prio) + chipStatus(t.status) + (l.areaAr ? `<span class="chip plain">${esc(l.areaAr)}</span>` : "") + (l.dup ? `<span class="chip plain">مكررة في الدليل</span>` : "")
    + (t.dnc ? `<span class="chip" style="--c:var(--p-high)">طلبوا عدم التواصل</span>` : "")
    + (t.next && !CLOSED.has(t.status) ? `<span class="chip" style="--c:var(${isDue(t) ? "--p-high" : "--st-called"})">الموعد: ${fmtRel(t.next)}</span>` : "")
    + (t.attempts ? `<span class="chip plain">محاولات بلا رد: ${t.attempts}/3</span>` : "");
  const fields = phonesOf(l).map((p) => ({ k: p.k, v: p.n, tel: true }));
  if (t.contact?.mobile) fields.push({ k: "المسؤول", v: t.contact.mobile, tel: true });
  if (l.email) fields.push({ k: "البريد", v: l.email });
  if (t.contact?.email) fields.push({ k: "بريد المسؤول", v: t.contact.email });
  $("#dPhones").innerHTML = (fields.length ? fields.map((f) => `<div class="phone" data-copy-wrap><span class="k">${f.k}</span>
      ${f.tel ? `<a class="n num" data-copy-src href="tel:${f.v.length === 8 ? "+965" : ""}${esc(f.v)}">${esc(f.v)}</a>` : `<span class="n num" data-copy-src style="font-size:14px">${esc(f.v)}</span>`}
      <button class="btn small" type="button" data-copy="${esc(f.v)}">نسخ</button>
      ${f.tel && isMobileKw(f.v) ? `<a class="btn small" href="https://wa.me/965${esc(f.v)}" target="_blank" rel="noopener">واتساب</a>` : ""}</div>`).join("")
    : `<p class="muted" style="margin:0">لا يوجد هاتف أو بريد في الدليل. ابحث عن رقم المنشأة وأضفه في «المسؤول في المنشأة».</p>`)
    + (l.web ? `<div class="phone"><span class="k">الموقع</span><a class="num" href="${/^https?:/i.test(l.web) ? "" : "https://"}${esc(l.web)}" target="_blank" rel="noopener">${esc(l.web)}</a></div>` : "");
  const hist = (t.hist || []).slice().reverse();
  $("#dHist").innerHTML = hist.length ? hist.map((h) => `<li style="--c:var(${(STATUS[h.st] || STATUS.new).c})">
      <div class="h1">${esc(OUT_AR[h.o] || h.o)} ${chipStatus(h.st)}</div>
      <div class="h2">${fmtFull.format(new Date(h.t))} · ${CHANNELS[h.ch] || ""}${h.by ? ` · ${esc(h.by)}` : ""}</div>
      ${h.x ? `<div class="h3 muted">${esc(h.x)}</div>` : ""}${h.s ? `<div class="h3">${esc(h.s)}</div>` : ""}</li>`).join("")
    : `<li style="border:0;padding-inline-start:0"><span class="muted">لا يوجد تواصل مسجّل بعد.</span></li>`;
  // Refresh the email warning line (status may have changed) without touching what the user edited.
  const w = $("#mailWarn"); if (w) w.innerHTML = mailWarning(l, t);
}

/* ---------- Email card ---------- */
function defaultStep(t) {
  const sent = (t.hist || []).filter((h) => h.o === "email_sent").length;
  return STEPS[Math.min(sent, 2)].k;
}
function mailWarning(l, t) {
  if (t.dnc) return `<div class="warn">طلبت هذه المنشأة عدم التواصل. لا ترسل لها.</div>`;
  if (["won", "lost", "invalid", "meeting", "quoted"].includes(t.status)) return `<div class="warn">حالة المنشأة «${STATUS[t.status].ar}»؛ رسائل التعريف والمتابعة غير مناسبة عادةً لها.</div>`;
  return "";
}
function renderMail() {
  const l = S.byId.get(S.openId), t = T(S.openId);
  const m = buildEmail(l, t, S.mailStep, S.me?.name);
  const sentCount = (t.hist || []).filter((h) => h.o === "email_sent").length;
  $("#mailBox").innerHTML = `<div class="mail-fields">
    <div id="mailWarn">${mailWarning(l, t)}</div>
    <div class="mail-line"><span class="lbl">النوع</span>
      <select id="mStep" class="val" style="flex:1 1 200px">${STEPS.map((s) => `<option value="${s.k}" ${s.k === S.mailStep ? "selected" : ""}>${s.ar}</option>`).join("")}</select>
      <span class="tier">${TIER_AR[tier(l.div)]}${sentCount ? ` · أُرسل ${sentCount} من قبل` : ""}</span></div>
    <div class="mail-line" data-copy-wrap><span class="lbl">إلى</span>
      ${m.to ? `<span class="val num" data-copy-src>${esc(m.to)}</span><button class="btn small" type="button" data-copy="${esc(m.to)}">نسخ</button>`
        : `<span class="val muted">لا يوجد بريد في الدليل. أضف بريد المسؤول من «المسؤول في المنشأة».</span>`}</div>
    <div class="mail-line" data-copy-wrap><span class="lbl">العنوان</span><input id="mSubj" class="val" data-copy-src value="${esc(m.subject)}"><button class="btn small" type="button" id="mCopySubj">نسخ</button></div>
    <div data-copy-wrap><textarea id="mBody" class="mail-body" data-copy-src>${esc(m.body)}</textarea></div>
    <div class="actions" style="justify-content:space-between">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn primary" type="button" id="mCopyBody">نسخ الرسالة</button>
        ${m.to ? `<a class="btn" id="mOpen" href="#">فتح في برنامج البريد</a>` : ""}
        <button class="btn small" type="button" id="mReset">إعادة النص الأصلي</button>
      </div>
      <button class="btn" type="button" id="mSent" ${t.dnc ? "disabled" : ""}>سجّل أنه أُرسل</button>
    </div>
    <div class="hint">انسخ العنوان والرسالة وأرسلها من بريد ${esc("info@envo-green.com")}، ثم اضغط «سجّل أنه أُرسل» لتُضاف للسجل وتُجدول متابعة بعد 7 أيام عمل.</div>
  </div>`;
  $("#mStep").onchange = (e) => { S.mailStep = e.target.value; renderMail(); };
  $("#mReset").onclick = () => renderMail();
  $("#mCopySubj").onclick = (e) => copyText($("#mSubj").value, e.target);
  $("#mCopyBody").onclick = (e) => copyText($("#mBody").value, e.target);
  const open = $("#mOpen");
  if (open) open.onclick = (e) => {
    e.preventDefault();
    location.href = `mailto:${encodeURIComponent(m.to)}?subject=${encodeURIComponent($("#mSubj").value)}&body=${encodeURIComponent($("#mBody").value)}`;
  };
  $("#mSent").onclick = async (e) => {
    e.target.disabled = true;
    const step = STEPS.find((s) => s.k === S.mailStep);
    const doc = await write({ lead_id: S.openId, kind: "outcome", o: "email_sent", ch: "email", subject: $("#mSubj").value, summary: `${step.ar}${m.to ? " إلى " + m.to : ""}` });
    e.target.disabled = false;
    if (doc) { toast("سُجّل الإرسال، والمتابعة بعد 7 أيام عمل"); fillForms(doc); S.mailStep = defaultStep(doc); renderMail(); }
  };
}

/* ---------- Logging ---------- */
function pickOutcome(k) {
  S.sel = k;
  $("#lOut").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.o === k));
  const o = OUTCOMES.find((x) => x.k === k), ex = $("#lExtra");
  const def = toLocalInput(addWorkingDays(new Date(), 1, 10, 0));
  if (o.needs === "when") ex.innerHTML = `<div class="form-grid"><label class="full">${k === "meeting" ? "موعد الزيارة" : "موعد إعادة الاتصال"}<input id="lWhen" type="datetime-local" value="${def}"></label></div>`;
  else if (o.needs === "reason") ex.innerHTML = `<div class="form-grid"><label class="full">سبب عدم الاهتمام (سطر واحد)<input id="lReason" list="reasons" placeholder="عندنا مكتب استشاري…"></label>
      <datalist id="reasons"><option>عندنا مكتب استشاري</option><option>ما عندنا مشاكل مع الهيئة</option><option>المصنع متوقف</option><option>السعر</option><option>تابعين للشركة الأم</option></datalist></div>`;
  else if (o.needs === "contact") ex.innerHTML = `<div class="form-grid"><label>اسم المسؤول<input id="gName"></label><label>المنصب<input id="gRole" placeholder="مدير المصنع / HSE"></label><label class="full">الجوال<input id="gMob" inputmode="tel" class="num"></label></div>`;
  else ex.innerHTML = "";
  const hints = {
    no_answer: "يُعاد الاتصال بعد يومي عمل. بعد 3 محاولات بلا رد تُغلق المنشأة كـ«غير مهتم».",
    interested: "الحالة ← تم إرسال تعريف، ومتابعة بالاتصال بعد 5 أيام عمل. ستظهر رسالة واتساب جاهزة، والبريد في بطاقة «إرسال بريد».",
    callback: "الحالة ← تم الاتصال. أي موعد خارج أيام/ساعات العمل يُنقل لأقرب وقت عمل.",
    meeting: "الحالة ← اجتماع/زيارة.", quoted: "الحالة ← عرض سعر مُرسل، ومتابعة بعد 7 أيام عمل.",
    won: "الحالة ← عميل. تُغلق المتابعة.", not_interested: "الحالة ← غير مهتم.", wrong_number: "الحالة ← بيانات غير صحيحة/مغلقة.",
    gatekeeper: "يُحفظ المسؤول ويُعاد الاتصال بعد يوم عمل واحد.", note: "تُضاف الملاحظة للسجل دون تغيير الحالة.",
  };
  $("#lHint").textContent = hints[k];
  $("#lSave").disabled = false;
  $("#lAfter").innerHTML = "";
}
async function submitLog() {
  const id = S.openId, l = S.byId.get(id), k = S.sel; if (!k) return;
  const p = { lead_id: id, kind: "outcome", o: k, ch: $("#lCh").value, summary: $("#lSum").value };
  if (k === "callback" || k === "meeting") {
    const raw = fromLocalInput($("#lWhen").value);
    if (!raw) { toast("حدّد التاريخ والوقت"); return; }
    const snapped = snapToWorking(raw);
    if (snapped.getTime() !== raw.getTime()) toast("نُقل الموعد إلى وقت عمل: " + fmtFull.format(snapped));
    p.when = snapped.toISOString();
  }
  if (k === "not_interested") p.reason = $("#lReason").value.trim();
  if (k === "gatekeeper") p.contact = { name: $("#gName").value.trim(), role: $("#gRole").value.trim(), mobile: $("#gMob").value.replace(/\D/g, "") };
  if (k === "note" && !p.summary.trim()) { toast("اكتب الملاحظة أولاً"); return; }
  $("#lSave").disabled = true;
  const doc = await write(p);
  if (!doc) { $("#lSave").disabled = false; return; }
  if (S.openId !== id) return;
  toast("تم الحفظ: " + STATUS[doc.status].ar);
  $("#lSum").value = ""; $("#lExtra").innerHTML = ""; S.sel = null;
  $("#lOut").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
  fillForms(doc);
  if (k === "interested") $("#lAfter").innerHTML = whatsappMessage(l, doc);
}
function whatsappMessage(l, t) {
  const who = t.contact?.name ? `الأستاذ/ة ${t.contact.name}` : "حضراتكم";
  const prod = l.products[0] ? ` في ${l.products[0]}` : "";
  const area = l.areaAr ? ` في ${l.areaAr}` : "";
  const msg = `السلام عليكم ${who}،
معكم شركة البيئة الخضراء للاستشارات والمختبرات البيئية (GEC)، مكتب معتمد من الهيئة العامة للبيئة بدرجة (أ). شكراً على وقتكم في الاتصال اليوم.
نساعد المصانع العاملة${prod} على استكمال متطلبات الهيئة العامة للبيئة: التصريح البيئي وتجديده، برامج الرصد البيئي (الهواء والضوضاء ومياه الصرف)، وخطط إدارة النفايات.
يسعدنا ترتيب زيارة قصيرة لمصنعكم${area} لمراجعة وضع التصريح دون أي التزام.
${S.me?.name || ""} · هاتف: 22245887 · واتساب: 92232178 · geckuw.com`;
  return `<div style="margin-top:12px"><h3 style="font-size:13px;color:var(--muted)">رسالة جاهزة للواتساب</h3>
    <div data-copy-wrap><div class="msgbox" data-copy-src>${esc(msg)}</div>
    <div class="actions"><button class="btn small" type="button" data-copy="${esc(msg)}">نسخ الرسالة</button></div></div></div>`;
}
async function saveContact() {
  const id = S.openId, cur = T(id).contact || {};
  const contact = { name: $("#cName").value.trim(), role: $("#cRole").value.trim(), mobile: $("#cMob").value.replace(/\D/g, ""), email: $("#cMail").value.trim() };
  if (["name", "role", "mobile", "email"].every((k) => (cur[k] || "") === contact[k])) { toast("لا يوجد تغيير"); return; }
  const doc = await write({ lead_id: id, kind: "contact", contact });
  if (doc) { toast("تم حفظ بيانات المسؤول"); if (S.openId === id) renderMail(); }
}
async function saveManual() {
  const id = S.openId, cur = T(id);
  const st = $("#mSt").value, raw = fromLocalInput($("#mNext").value), dnc = $("#mDnc").checked;
  const next = raw ? snapToWorking(raw) : null;
  if (raw && next.getTime() !== raw.getTime()) toast("نُقل الموعد إلى وقت عمل: " + fmtFull.format(next));
  const nextIso = next && !CLOSED.has(st) ? next.toISOString() : null;
  if (st === cur.status && nextIso === (cur.next || null) && dnc === !!cur.dnc) { toast("لا يوجد تغيير"); return; }
  const doc = await write({ lead_id: id, kind: "manual", status: st, next: nextIso, dnc });
  if (doc) { toast("تم الحفظ"); if (S.openId === id) { fillForms(doc); renderMail(); } }
}

/* ---------- Export (CSV opens in Excel with Arabic) ---------- */
function exportCsv() {
  const cols = ["الرقم", "اسم المنشأة", "رمز القطاع", "القطاع", "النشاط الفرعي", "المنطقة", "هاتف المكتب", "هاتف المصنع", "البريد", "الموقع", "الأولوية", "الحالة", "لا تتواصل", "الموعد القادم", "آخر تواصل", "محاولات بلا رد", "المسؤول", "المنصب", "جوال المسؤول", "بريد المسؤول", "عدد التفاعلات", "آخر ملاحظة", "آخر من سجّل"];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = S.leads.map((l) => {
    const t = T(l.id), s = S.sectorBy[l.div], g = s.groups.find((x) => x.code === l.grp), hist = t.hist || [];
    const lastNote = hist.slice().reverse().find((h) => h.s)?.s || "";
    return [l.id, l.name, l.div, s.name, g?.name, l.areaAr, l.office.join(" / "), l.factory.join(" / "), l.email, l.web, l.prio, STATUS[t.status].ar, t.dnc ? "نعم" : "",
      t.next ? fmtFull.format(new Date(t.next)) : "", t.lastAt ? fmtFull.format(new Date(t.lastAt)) : "", t.attempts || 0,
      t.contact?.name, t.contact?.role, t.contact?.mobile, t.contact?.email, hist.length, lastNote, hist.length ? hist[hist.length - 1].by || "" : ""].map(q).join(",");
  });
  const p = kwParts(new Date()), z = (n) => String(n).padStart(2, "0");
  const blob = new Blob(["﻿" + [cols.map(q).join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gec-leads-${p.y}${z(p.m + 1)}${z(p.d)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- Events ---------- */
function closeMenu() { $("#userMenu").hidden = true; $("#userBtn").setAttribute("aria-expanded", "false"); }
document.addEventListener("click", (e) => {
  const cp = e.target.closest("[data-copy]"); if (cp) { e.preventDefault(); copyText(cp.dataset.copy, cp); return; }
  const op = e.target.closest("[data-open]"); if (op) { openLead(+op.dataset.open); return; }
  if (e.target.closest("[data-close]")) { closeDrawer(); return; }
  if (e.target.closest("#userBtn")) { const m = $("#userMenu"); m.hidden = !m.hidden; $("#userBtn").setAttribute("aria-expanded", String(!m.hidden)); return; }
  if (!e.target.closest(".usermenu")) closeMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
  if (S.openId == null) return;
  if (e.key === "Escape") { closeDrawer(); return; }
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  const o = OUTCOMES.find((x) => x.key === e.key);
  if (o) { e.preventDefault(); pickOutcome(o.k); }
});
$("#gSearchForm").onsubmit = (e) => e.preventDefault();
$("#gSearch").oninput = (e) => { S.q = e.target.value; if (S.q.trim()) { if (S.route.name !== "search") location.hash = "search"; else updateSearch(); } };
$("#exportBtn").onclick = exportCsv;
$("#logoutBtn").onclick = async () => { try { await api("api/auth", { method: "POST", body: { action: "logout" } }); } catch {} stopPolling(); S.me = null; closeDrawer(); authScreen("login"); };
window.addEventListener("hashchange", go);

boot();
