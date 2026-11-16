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
    globe: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    pin: '<path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="9" r="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/>',
    x: '<path d="M18.9 3H22l-6.8 7.8L23 21h-6.3l-4.9-6.4L6.2 21H3l7.3-8.4L2.6 3h6.4l4.4 5.8L18.9 3Zm-1.1 16h1.7L7.1 4.7H5.3L17.8 19Z" fill="currentColor"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor"/>',
    linkedin: '<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 10v7M8 7v.1M12 17v-4a2.5 2.5 0 0 1 5 0v4M12 10v7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    snapchat: '<path d="M12 3c3 0 5 2.2 5 5.2 0 1.2-.2 2.2-.4 2.8.7.4 1.6.7 2.3.8-.2.8-.8 1.2-1.5 1.4.2.6.7 1.2 1.5 1.6-.5.7-1.4 1-2.2 1.1-.2.7-.5 1.3-1.1 1.3-.5 0-.9-.2-1.4-.2-.7 0-1.2.7-2.2.7s-1.5-.7-2.2-.7c-.5 0-.9.2-1.4.2-.6 0-.9-.6-1.1-1.3-.8-.1-1.7-.4-2.2-1.1.8-.4 1.3-1 1.5-1.6-.7-.2-1.3-.6-1.5-1.4.7-.1 1.6-.4 2.3-.8-.2-.6-.4-1.6-.4-2.8C7 5.2 9 3 12 3Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    tiktok: '<path d="M14 3v10.5a3.5 3.5 0 1 1-3-3.46M14 3c.5 2.5 2 4 4.5 4.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z" fill="currentColor"/>',
    arrow: '<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    save: '<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    share: '<circle cx="6" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="6" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="18" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m8 11 8-4M8 13l8 4" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.link}</svg>`;
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

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function handleOf(kind, url) {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    const last = decodeURIComponent(path.split("/").filter(Boolean).pop() || "");
    if (!last) return hostOf(url);
    const clean = last.replace(/^@+/, "");
    if (kind === "linkedin") return path.startsWith("/in/") ? `in/${clean}` : clean;
    return ["x", "instagram", "snapchat", "tiktok"].includes(kind) ? `@${clean}` : clean;
  } catch { return url; }
}

function contactRow(kind, label, value, href, external = false, ltr = false) {
  return `<a class="crow" href="${esc(href)}" ${external ? 'target="_blank" rel="noopener"' : ""}>
    <span class="cic">${icon(kind)}</span>
    <span class="ctx"><b>${esc(label)}</b><span ${ltr ? 'dir="ltr"' : ""}>${esc(value)}</span></span>
    <span class="car">${icon("arrow")}</span>
  </a>`;
}

function mapHref(card) {
  if (card.mapUrl) return card.mapUrl;
  if (!card.location) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(card.location)}`;
}

function contactsFor(card) {
  const rows = [];
  if (card.phone) {
    rows.push(contactRow("phone", "اتصال مباشر", card.phone, `tel:${card.phone.replace(/[^\d+]/g, "")}`, false, true));
  }
  const wa = card.whatsapp || card.phone;
  if (wa) rows.push(contactRow("whatsapp", "واتساب", "راسلني مباشرة", `https://wa.me/${waNumber(wa)}`, true));
  if (card.email) rows.push(contactRow("mail", "البريد الإلكتروني", card.email, `mailto:${card.email}`, false, true));
  if (card.website) rows.push(contactRow("globe", "الموقع الإلكتروني", hostOf(card.website), card.website, true, true));
  const map = mapHref(card);
  if (map) rows.push(contactRow("pin", "اللوكيشن", card.location || "افتح على الخريطة", map, true));
  const socials = [
    ["x", "X (تويتر)", card.xUrl],
    ["instagram", "إنستغرام", card.instagramUrl],
    ["linkedin", "لينكدإن", card.linkedinUrl],
    ["snapchat", "سناب شات", card.snapchatUrl],
    ["tiktok", "تيك توك", card.tiktokUrl],
    ["facebook", "فيسبوك", card.facebookUrl],
  ];
  for (const [kind, label, url] of socials) {
    if (url) rows.push(contactRow(kind, label, handleOf(kind, url), url, true, true));
  }
  return rows;
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
  document.title = `${card.nameAr} — بطاقة | البيئة الخضراء`;
  const theme = card.theme === "noir" ? "noir" : "forest";
  const photo = card.photo
    ? `<img src="${esc(card.photo)}" alt="${esc(card.nameAr)}">`
    : esc(initials(card.nameAr) || "؟");
  const rows = contactsFor(card);
  const joined = fmtDate(card.joinedOn);

  root.classList.remove("has-error");
  root.innerHTML = `
  <article class="idcard theme-${theme}" aria-label="بطاقة ${esc(card.nameAr)}">
    <span class="glow a" aria-hidden="true"></span><span class="glow b" aria-hidden="true"></span>

    <header class="ctop">
      <span class="logo-plate"><img src="/gec-logo.png" alt="شركة البيئة الخضراء"></span>
      <span class="company">شركة البيئة الخضراء</span>
      <span class="company-en">GREEN ENVIRONMENT</span>
    </header>

    <section class="person">
      ${card.showPhoto !== false ? `<div class="avatar"><div class="avatar-inner">${photo}</div></div>` : ""}
      <h1>${esc(card.nameAr)}</h1>
      ${card.nameEn ? `<p class="en">${esc(card.nameEn)}</p>` : ""}
      <p class="role">${esc(card.titleAr)}</p>
      ${card.titleEn ? `<p class="role-en">${esc(card.titleEn)}</p>` : ""}
      ${card.department ? `<span class="dept">${esc(card.department)}</span>` : ""}
    </section>

    <div class="rule" aria-hidden="true"><i></i></div>

    ${rows.length ? `<section class="contact" aria-label="التواصل والحسابات">${rows.join("")}</section>` : ""}

    <footer class="cfoot">
      <div class="qr-wrap"><div id="cardQr" aria-label="رمز QR للبطاقة"></div></div>
      <div class="foot-meta">
        <b class="ltr">${esc(card.employeeNo)}</b>
        ${joined ? `<small>انضم في ${esc(joined)}</small>` : ""}
        <small>امسح رمز QR للتحقق · geckuw.com</small>
      </div>
    </footer>
  </article>

  <div class="actions">
    <button type="button" class="btn-save" id="saveContact">${icon("save")} حفظ جهة الاتصال</button>
    <button type="button" class="btn-share" id="shareBtn">${icon("share")} مشاركة البطاقة</button>
  </div>
  <p class="site-note">بطاقة رقمية · شركة البيئة الخضراء · <a href="https://geckuw.com" target="_blank" rel="noopener">geckuw.com</a></p>`;

  const url = `${CARD_ORIGIN}/card/?id=${encodeURIComponent(card.id)}`;
  try {
    new QRCode(document.getElementById("cardQr"), {
      text: url, width: 260, height: 260,
      colorDark: theme === "noir" ? "#0B0B09" : "#0B2110",
      colorLight: "#FFFFFF", correctLevel: QRCode.CorrectLevel.M,
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
    card.whatsapp && card.whatsapp !== card.phone ? `TEL;TYPE=WORK:${v(card.whatsapp)}` : "",
    card.email ? `EMAIL;TYPE=WORK:${v(card.email)}` : "",
    card.website ? `URL;TYPE=WORK:${v(card.website)}` : "",
    card.location ? `ADR;TYPE=WORK:;;${v(card.location)};;;;` : "",
    card.xUrl ? `X-SOCIALPROFILE;TYPE=twitter:${v(card.xUrl)}` : "",
    card.instagramUrl ? `X-SOCIALPROFILE;TYPE=instagram:${v(card.instagramUrl)}` : "",
    card.linkedinUrl ? `X-SOCIALPROFILE;TYPE=linkedin:${v(card.linkedinUrl)}` : "",
    card.snapchatUrl ? `X-SOCIALPROFILE;TYPE=snapchat:${v(card.snapchatUrl)}` : "",
    card.tiktokUrl ? `X-SOCIALPROFILE;TYPE=tiktok:${v(card.tiktokUrl)}` : "",
    card.facebookUrl ? `X-SOCIALPROFILE;TYPE=facebook:${v(card.facebookUrl)}` : "",
    `URL:${url}`,
    `NOTE:${v(`بطاقة — ${card.employeeNo}`)}`,
    "END:VCARD",
  ].filter(Boolean);
  const blob = new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/vcard;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${String(card.employeeNo || "employee").replace(/[^A-Za-z0-9._-]/g, "_")}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("تم تجهيز جهة الاتصال.");
}

async function shareCard(card, url) {
  const data = {
    title: `${card.nameAr} — بطاقة`,
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
  }[kind] || "بطاقة | البيئة الخضراء";
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
