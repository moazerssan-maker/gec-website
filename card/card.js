/* Public employee card: reads only /api/card?id=… and renders the digital badge. */

const CARD_ORIGIN = "https://geckuw.com";
const root = document.getElementById("root");
const toastEl = document.getElementById("toast");

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const initials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
};

const icon = (name) => {
  const paths = {
    phone: '<path d="M7 4h3l1.5 4-2 1.5a12 12 0 0 0 5 5L16 12.5 20 14v3a2 2 0 0 1-2 2A14 14 0 0 1 5 6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    whatsapp: '<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.6 8.7c.2-.5.5-.5.8-.5h.4c.2 0 .4 0 .6.4l.7 1.6c.1.2 0 .4-.1.5l-.5.6c-.1.1-.2.3 0 .6.5.9 1.3 1.6 2.2 2.1.3.1.4.1.6-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.4.2.4.4 0 .2 0 1-.4 1.4-.4.4-1 .7-1.8.7-.7 0-1.7-.3-3-1.2-1.2-.9-2.1-2-2.5-2.7-.4-.7-.6-1.3-.6-1.8 0-.6.3-1 .5-1.2Z" fill="currentColor"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m3.5 7 8.5 6 8.5-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
    arrow: '<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    save: '<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    share: '<circle cx="6" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="6" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="18" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m8 11 8-4M8 13l8 4" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
};

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove("show"), 2800);
}

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("ar-KW-u-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(d);
  } catch { return iso; }
};

const waNumber = (phone) => {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("965")) return d;
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 8) d = `965${d}`;
  return d;
};

function contactRow(kind, label, value, href) {
  return `<a href="${esc(href)}" ${kind === "wa" ? 'target="_blank" rel="noopener"' : ""}>
    <span class="ic">${icon(kind === "wa" ? "whatsapp" : kind)}</span>
    <span class="tx"><b>${esc(label)}</b><span>${esc(value)}</span></span>
    <span class="arrow">${icon("arrow")}</span>
  </a>`;
}

async function init() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return unavailable("missing");
  let data;
  try {
    const r = await fetch(`/api/card?id=${encodeURIComponent(id)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (r.status === 400 || r.status === 404) return unavailable("hidden");
    if (!r.ok) throw new Error("http");
    data = await r.json();
  } catch {
    return unavailable("error");
  }
  if (!data?.card) return unavailable("hidden");
  render(data.card);
}

function render(card) {
  document.title = `${card.nameAr} — بطاقة موظف | البيئة الخضراء`;
  const theme = card.theme === "noir" ? "noir" : "forest";
  const photo = card.photo
    ? `<img src="${esc(card.photo)}" alt="${esc(card.nameAr)}">`
    : esc(initials(card.nameAr) || "؟");

  const contacts = [];
  if (card.phone) {
    contacts.push(contactRow("phone", "اتصال مباشر", card.phone, `tel:${card.phone.replace(/[^\d+]/g, "")}`));
    contacts.push(contactRow("wa", "واتساب", "راسلني مباشرة", `https://wa.me/${waNumber(card.phone)}`));
  }
  if (card.email) contacts.push(contactRow("mail", "البريد الإلكتروني", card.email, `mailto:${card.email}`));

  const joined = fmtDate(card.joinedOn);
  const secondFact = joined
    ? { label: "تاريخ الانضمام", value: joined, ltr: false }
    : { label: "القسم", value: card.department || "—", ltr: false };

  root.classList.remove("has-error");
  root.innerHTML = `
  <article class="idcard theme-${theme}" aria-label="بطاقة موظف ${esc(card.nameAr)}">
    <span class="orbit a" aria-hidden="true"></span><span class="orbit b" aria-hidden="true"></span>
    <header class="id-top">
      <span class="brand-plate"><img src="/gec-logo.png" alt="البيئة الخضراء"></span>
      <span class="id-kind">بطاقة موظف<small>EMPLOYEE ID</small></span>
    </header>

    <section class="person">
      <div class="avatar"><div class="avatar-inner">${photo}</div></div>
      <h1>${esc(card.nameAr)}</h1>
      ${card.nameEn ? `<p class="en">${esc(card.nameEn)}</p>` : ""}
      <p class="role">${esc(card.titleAr)}</p>
      ${card.titleEn ? `<p class="role-en">${esc(card.titleEn)}</p>` : ""}
      ${card.department ? `<span class="dept">${esc(card.department)}</span>` : ""}
    </section>

    <section class="facts">
      <div class="fact"><small>الرقم الوظيفي</small><b class="ltr">${esc(card.employeeNo)}</b></div>
      <div class="fact"><small>${esc(secondFact.label)}</small><b class="${secondFact.ltr ? "ltr" : ""}">${esc(secondFact.value)}</b></div>
    </section>

    ${contacts.length ? `<section class="contact" aria-label="التواصل">${contacts.join("")}</section>` : ""}

    <footer class="id-foot">
      <div class="qr-box"><div id="cardQr" aria-label="رمز QR للبطاقة"></div></div>
      <div class="qr-note"><b>امسح للتحقق من البطاقة</b><span>رابط رسمي صادر عن شركة البيئة الخضراء</span></div>
      <div class="brand-mini"><b>GEC</b>geckuw.com</div>
    </footer>
  </article>

  <div class="actions">
    <button type="button" class="btn-save" id="saveContact">${icon("save")} حفظ جهة الاتصال</button>
    <button type="button" class="btn-share" id="shareBtn">${icon("share")} مشاركة البطاقة</button>
  </div>
  <p class="site-note">بطاقة موظف رقمية · شركة البيئة الخضراء · <a href="https://geckuw.com" target="_blank" rel="noopener">geckuw.com</a></p>`;

  const url = `${CARD_ORIGIN}/card/?id=${encodeURIComponent(card.id)}`;
  try {
    new QRCode(document.getElementById("cardQr"), {
      text: url, width: 220, height: 220,
      colorDark: "#0B2110", colorLight: "#FFFFFF", correctLevel: QRCode.CorrectLevel.M,
    });
  } catch {}

  document.getElementById("saveContact").onclick = () => saveVCard(card, url);
  document.getElementById("shareBtn").onclick = () => shareCard(card, url);
}

function saveVCard(card, url) {
  const v = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${v(card.nameAr)};;;;`,
    `FN:${v(card.nameAr)}`,
    "ORG:شركة البيئة الخضراء",
    `TITLE:${v(card.titleAr)}`,
    card.phone ? `TEL;TYPE=CELL:${v(card.phone)}` : "",
    card.email ? `EMAIL;TYPE=WORK:${v(card.email)}` : "",
    `URL:${url}`,
    `NOTE:${v(`بطاقة موظف — ${card.employeeNo}`)}`,
    "END:VCARD",
  ].filter(Boolean);
  const blob = new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/vcard;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `GEC-${card.employeeNo}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("تم تجهيز جهة الاتصال.");
}

async function shareCard(card, url) {
  const data = {
    title: `${card.nameAr} — بطاقة موظف`,
    text: `${card.nameAr} · ${card.titleAr} — البيئة الخضراء`,
    url,
  };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch { /* user cancelled */ }
  }
  try { await navigator.clipboard.writeText(url); toast("تم نسخ رابط البطاقة."); }
  catch {
    const t = document.createElement("textarea");
    t.value = url;
    t.style.cssText = "position:fixed;left:-9999px";
    document.body.appendChild(t);
    t.select();
    try { document.execCommand("copy"); toast("تم نسخ رابط البطاقة."); }
    catch { toast("انسخ الرابط من شريط المتصفح."); }
    t.remove();
  }
}

function unavailable(kind) {
  root.classList.add("has-error");
  document.title = {
    missing: "رابط البطاقة غير مكتمل | البيئة الخضراء",
    hidden: "البطاقة غير متاحة | البيئة الخضراء",
    error: "تعذّر تحميل البطاقة | البيئة الخضراء",
  }[kind] || "بطاقة موظف | البيئة الخضراء";
  const copy = {
    missing: ["رابط البطاقة غير مكتمل", "افتح الرابط الظاهر في رمز QR كما هو، أو اطلب الرابط الصحيح من الموظف."],
    hidden: ["البطاقة غير متاحة", "قد تكون البطاقة مخفية مؤقتاً من إدارة الشركة، أو أن الرابط لم يعد صالحاً. تواصل مع الموظف أو مع مكتب البيئة الخضراء."],
    error: ["تعذّر تحميل البطاقة", "حدث خطأ مؤقت في الاتصال. حدّث الصفحة بعد لحظات، وإذا استمرت المشكلة تواصل مع مكتب البيئة الخضراء."],
  }[kind] || [];
  root.innerHTML = `<section class="unavailable" role="alert">
    <span class="plate"><img src="/gec-logo.png" alt="البيئة الخضراء"></span>
    <div class="icon">${icon(kind === "hidden" ? "lock" : "link")}</div>
    <h1>${esc(copy[0])}</h1>
    <p>${esc(copy[1])}</p>
    <a class="btn" href="https://geckuw.com" target="_blank" rel="noopener">زيارة موقع البيئة الخضراء ${icon("arrow")}</a>
    <div class="foot">شركة البيئة الخضراء · مكتب بيئي معتمد · الكويت</div>
  </section>`;
}

init();
