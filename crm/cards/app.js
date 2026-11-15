/* Employee ID cards — staff page.
   Uses the existing /crm/api session; only admins can open it. */

const CARD_ORIGIN = "https://geckuw.com";

const ERR = {
  network: "تعذّر الاتصال بالخادم. تحقق من الإنترنت.",
  unauthenticated: "انتهت الجلسة. سجّل الدخول مرة أخرى.",
  forbidden: "هذه الصفحة للمدير فقط.",
  name_required: "اسم الموظف مطلوب (حرفان على الأقل).",
  title_required: "المسمى الوظيفي مطلوب (حرفان على الأقل).",
  bad_phone: "رقم الجوال غير صحيح. مثال: +965 9223 2178",
  bad_whatsapp: "رقم واتساب غير صحيح. مثال: +965 9223 2178",
  bad_email: "البريد الإلكتروني غير صحيح.",
  bad_website: "رابط الموقع الإلكتروني غير صحيح.",
  bad_map: "رابط اللوكيشن غير صحيح.",
  bad_x: "رابط حساب X غير صحيح. يمكنك كتابة @اسم_المستخدم فقط.",
  bad_instagram: "رابط حساب إنستغرام غير صحيح. يمكنك كتابة @اسم_المستخدم فقط.",
  bad_linkedin: "رابط حساب لينكدإن غير صحيح.",
  bad_snapchat: "رابط حساب سناب شات غير صحيح. يمكنك كتابة @اسم_المستخدم فقط.",
  bad_tiktok: "رابط حساب تيك توك غير صحيح. يمكنك كتابة @اسم_المستخدم فقط.",
  bad_facebook: "رابط حساب فيسبوك غير صحيح.",
  bad_date: "تاريخ الانضمام غير صحيح.",
  bad_photo: "الصورة كبيرة أو بصيغة غير مدعومة. جرّب صورة أصغر.",
  bad_employee_no: "الرقم الوظيفي يقبل الأحرف الإنجليزية والأرقام فقط (بدون مسافات).",
  employee_no_taken: "الرقم الوظيفي مستخدم لموظف آخر.",
  not_found: "البطاقة غير موجودة أو حُذفت.",
  no_database: "قاعدة البيانات غير مربوطة بالمشروع.",
  db_connect: "تعذّر الاتصال بقاعدة البيانات.",
  server_error: "حدث خطأ في الخادم. حاول مرة أخرى.",
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const errText = (e) => ERR[e?.error || e] || ERR.server_error;

const norm = (s) => String(s || "").toLowerCase()
  .replace(/[ً-ٰٟـ]/g, "")
  .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
  .replace(/\s+/g, " ").trim();

const initials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
};

const icon = (name) => {
  const paths = {
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m13.5 6.5 4 4" stroke="currentColor" stroke-width="1.8"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M14 14h2v2h-2zM18 14h2v6h-6v-2M14 18h2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    print: '<path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 14h10v7H7z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.2 3.9M6.1 6.6C3.8 8.3 2.5 12 2.5 12S6 18 12 18a9.7 9.7 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
};

/* ---------- API ---------- */
async function api(path, opts = {}) {
  let r;
  try {
    r = await fetch(path, {
      credentials: "same-origin",
      headers: opts.body ? { "Content-Type": "application/json" } : {},
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch { throw { error: "network", status: 0 }; }
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw { ...data, status: r.status };
  return data;
}

/* ---------- State ---------- */
const S = { me: null, employees: [], filter: "all", q: "", editing: null, photo: "", busy: false };

function toast(msg) {
  const r = $("#toastRoot");
  r.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (r.innerHTML = ""), 3600);
}

/* ---------- Auth ---------- */
function authScreen(kind = "login", msg = "") {
  $("#appRoot").hidden = true;
  $("#drawerRoot").innerHTML = "";
  $("#modalRoot").innerHTML = "";
  const setup = kind === "setup";
  $("#authRoot").innerHTML = `<div class="auth"><form id="authForm" autocomplete="on">
    <img class="logo" src="/gec-logo.png" alt="البيئة الخضراء">
    <h1>بطاقات الموظفين</h1>
    <p>${setup ? "لم يُنشأ حساب المدير بعد. أكمل الإعداد من صفحة متابعة المنشآت ثم عد إلى هنا." : "سجّل الدخول بحساب المدير لإدارة بطاقات الموظفين."}</p>
    ${setup ? `<a class="btn primary" href="/crm/" style="justify-content:center">الانتقال إلى إعداد الدخول</a>` : `
      <label class="fld">اسم المستخدم<input id="aUser" required autocomplete="username" autocapitalize="none" dir="ltr"></label>
      <label class="fld">كلمة المرور<input id="aPass" type="password" required autocomplete="current-password" dir="ltr"></label>
      <div class="err" id="aErr">${esc(msg)}</div>
      <button class="btn primary" type="submit">دخول</button>
      <a class="back" href="/ar/index.html">العودة إلى موقع البيئة الخضراء</a>`}
  </form></div>`;
  if (setup) return;
  $("#authForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    $("#aErr").textContent = "";
    try {
      await api("/crm/api/auth", { method: "POST", body: { action: "login", username: $("#aUser").value, password: $("#aPass").value } });
      boot();
    } catch (err) {
      $("#aErr").textContent = err.status === 401 ? "اسم المستخدم أو كلمة المرور غير صحيحة." : errText(err);
      btn.disabled = false;
    }
  };
}

function denied(user) {
  $("#appRoot").hidden = true;
  $("#drawerRoot").innerHTML = "";
  $("#modalRoot").innerHTML = "";
  $("#authRoot").innerHTML = `<div class="auth"><form><img class="logo" src="/gec-logo.png" alt="البيئة الخضراء">
    <h1>بطاقات الموظفين</h1>
    <p>هذه الصفحة مخصّصة لمدير النظام. حسابك الحالي (${esc(user?.name || "")}) لا يملك صلاحية الإدارة.</p>
    <a class="btn primary" href="/crm/" style="justify-content:center">العودة إلى متابعة المنشآت</a>
  </form></div>`;
}

async function boot() {
  let me;
  try { me = await api("/crm/api/auth"); }
  catch (e) {
    if (e.status === 401) return authScreen("login");
    $("#authRoot").innerHTML = `<div class="auth"><form><img class="logo" src="/gec-logo.png" alt="البيئة الخضراء"><h1>بطاقات الموظفين</h1><p class="err">${esc(errText(e))}</p></form></div>`;
    return;
  }
  if (me.needsSetup) return authScreen("setup");
  if (me.user.role !== "admin") return denied(me.user);
  S.me = me.user;
  $("#authRoot").innerHTML = "";
  $("#appRoot").hidden = false;
  $("#userName").textContent = S.me.name;
  $("#userRole").textContent = `${S.me.username} · مدير`;
  await load();
}

/* ---------- Header menu ---------- */
function bindHeader() {
  $("#userBtn").onclick = (e) => {
    e.stopPropagation();
    const m = $("#userMenu");
    m.hidden = !m.hidden;
    $("#userBtn").setAttribute("aria-expanded", String(!m.hidden));
  };
  document.addEventListener("click", () => { $("#userMenu").hidden = true; $("#userBtn").setAttribute("aria-expanded", "false"); });
  $("#logoutBtn").onclick = async () => {
    try { await api("/crm/api/auth", { method: "POST", body: { action: "logout" } }); } catch {}
    location.href = "/crm/";
  };
}

/* ---------- Load + render ---------- */
async function load() {
  try {
    const d = await api("/crm/api/employees");
    S.employees = d.employees || [];
    render();
  } catch (e) {
    if (e.status === 401) return authScreen("login", "انتهت الجلسة، سجّل الدخول مرة أخرى.");
    if (e.status === 403) return denied(S.me);
    $("#grid").innerHTML = `<div class="empty-cards"><b>تعذّر تحميل البطاقات</b>${esc(errText(e))}</div>`;
  }
}

function filtered() {
  const q = norm(S.q);
  return S.employees.filter((e) => {
    if (S.filter === "on" && !e.visible) return false;
    if (S.filter === "off" && e.visible) return false;
    if (!q) return true;
    return norm([
      e.nameAr, e.nameEn, e.employeeNo, e.department, e.titleAr, e.phone, e.whatsapp,
      e.email, e.website, e.location, e.xUrl, e.instagramUrl, e.linkedinUrl,
      e.snapchatUrl, e.tiktokUrl, e.facebookUrl,
    ].join(" ")).includes(q);
  });
}

function render() {
  $("#statAll").textContent = S.employees.length;
  $("#statOn").textContent = S.employees.filter((e) => e.visible).length;
  $("#statOff").textContent = S.employees.filter((e) => !e.visible).length;

  const list = filtered();
  if (!S.employees.length) {
    $("#grid").innerHTML = `<div class="empty-cards"><b>لا توجد بطاقات بعد</b>أضف أول موظف، وأصدر له بطاقة برمز QR خلال دقيقة.<button class="btn primary" type="button" id="emptyAdd">إضافة أول موظف</button></div>`;
    $("#emptyAdd").onclick = () => openForm();
    return;
  }
  if (!list.length) {
    $("#grid").innerHTML = `<div class="empty-cards"><b>لا نتائج مطابقة</b>جرّب كلمة بحث أخرى أو اعرض كل البطاقات.</div>`;
    return;
  }

  $("#grid").innerHTML = list.map(tile).join("");
  for (const e of list) {
    const host = $(`[data-qr="${cssEscape(e.publicId)}"]`, $("#grid"));
    if (!host) continue;
    try {
      new QRCode(host, {
        text: cardUrl(e.publicId), width: 92, height: 92,
        colorDark: "#0E2B16", colorLight: "#FFFFFF", correctLevel: QRCode.CorrectLevel.M,
      });
    } catch {}
  }
}

const cssEscape = (v) => (window.CSS?.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, "\\$&"));
const cardUrl = (publicId) => `${CARD_ORIGIN}/card/?id=${encodeURIComponent(publicId)}`;

function tile(e) {
  const photo = e.photo
    ? `<img src="${esc(e.photo)}" alt="">`
    : esc(initials(e.nameAr));
  return `<article class="emp ${e.visible ? "" : "is-off"}" data-id="${e.id}">
    <div class="mini theme-${esc(e.theme)}">
      <span class="mini-logo"><img src="/gec-logo.png" alt="GEC"></span>
      <div class="mini-photo">${photo}</div>
      <b class="mini-name">${esc(e.nameAr)}</b>
      <small class="mini-title">${esc(e.titleAr)}</small>
      ${e.department ? `<span class="mini-dept">${esc(e.department)}</span>` : ""}
      <div class="mini-foot">
        <span class="mini-no">${esc(e.employeeNo)}</span>
        <div class="mini-qr" data-qr="${esc(e.publicId)}" aria-label="رمز QR للبطاقة"></div>
      </div>
    </div>
    <div class="emp-meta">
      <span class="status ${e.visible ? "on" : "off"}">${e.visible ? "ظاهرة" : "مخفية"}</span>
      <span class="emp-dept">${esc(e.department || e.titleEn || "—")}</span>
    </div>
    <div class="emp-actions">
      <button type="button" data-act="edit">${icon("edit")} تعديل</button>
      <button type="button" data-act="qr">${icon("qr")} QR</button>
      <button type="button" data-act="print">${icon("print")} طباعة</button>
      <button type="button" data-act="toggle">${icon(e.visible ? "eyeoff" : "eye")} ${e.visible ? "إخفاء" : "إظهار"}</button>
      <span class="spacer"></span>
      <button type="button" data-act="delete" class="danger" aria-label="حذف البطاقة">${icon("trash")}</button>
    </div>
  </article>`;
}

/* ---------- Actions ---------- */
function bindGrid() {
  $("#grid").addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn) return;
    const art = btn.closest(".emp");
    const e = S.employees.find((x) => x.id === Number(art?.dataset.id));
    if (!e) return;
    const act = btn.dataset.act;
    if (act === "edit") return openForm(e);
    if (act === "qr") return openQr(e);
    if (act === "print") return printCard(e);
    if (act === "delete") return confirmDelete(e);
    if (act === "toggle") {
      btn.disabled = true;
      try {
        const r = await api("/crm/api/employees", { method: "POST", body: { action: "visible", id: e.id, visible: !e.visible } });
        Object.assign(e, r.employee);
        render();
        toast(e.visible ? "البطاقة صارت ظاهرة." : "تم إخفاء البطاقة؛ رابط QR توقف.");
      } catch (err) {
        if (err.status === 401) return authScreen("login", "انتهت الجلسة، سجّل الدخول مرة أخرى.");
        toast(errText(err));
        btn.disabled = false;
      }
    }
  });

  $("#searchInput").addEventListener("input", (e) => { S.q = e.target.value; render(); });
  $("#searchForm").addEventListener("submit", (e) => e.preventDefault());
  $$(".seg button").forEach((b) => b.addEventListener("click", () => {
    S.filter = b.dataset.filter;
    $$(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render();
  }));
  $("#addBtn").onclick = () => openForm();
}

/* ---------- Form ---------- */
function openForm(employee = null) {
  S.editing = employee;
  S.photo = employee?.photo || "";
  const isEdit = !!employee;
  const e = employee || { theme: "forest", visible: true, showPhone: true, showEmail: true };
  const photo = S.photo ? `<img src="${esc(S.photo)}" alt="">` : esc(initials(e.nameAr) || "؟");

  $("#drawerRoot").innerHTML = `
  <div class="scrim" data-close></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawerTitle">
    <div class="d-head">
      <div class="ttl"><h2 id="drawerTitle">${isEdit ? "تعديل البطاقة" : "موظف جديد"}</h2>
      <div class="sub">${isEdit ? "أي تغيير يُحفظ على البطاقة ورابط QR نفسه." : "املأ البيانات، وستُولَّد البطاقة ورمز QR فور الحفظ."}</div></div>
      <button class="x" type="button" data-close aria-label="إغلاق">×</button>
    </div>
    <div class="d-body">
      <form id="empForm" novalidate>
        <div class="form-preview">
          <div class="mini theme-${esc(e.theme)}" id="formPreview">
            <span class="mini-logo"><img src="/gec-logo.png" alt="GEC"></span>
            <div class="mini-photo" data-pv="photo">${photo}</div>
            <b class="mini-name" data-pv="name">${esc(e.nameAr || "اسم الموظف")}</b>
            <small class="mini-title" data-pv="title">${esc(e.titleAr || "المسمى الوظيفي")}</small>
            <span class="mini-dept" data-pv="dept">${esc(e.department || "القسم / الإدارة")}</span>
            <div class="mini-foot">
              <span class="mini-no" data-pv="no">${esc(e.employeeNo || "GEC-000")}</span>
              <div class="mini-qr" aria-hidden="true"></div>
            </div>
          </div>
          <p class="hint">معاينة مباشرة لشكل البطاقة</p>
        </div>

        <section class="fset">
          <h3>بيانات الموظف</h3>
          <div class="fgrid">
            <label class="field"><span>الاسم بالعربية <b>*</b></span><input name="nameAr" required maxlength="80" value="${esc(e.nameAr)}" autocomplete="off"></label>
            <label class="field"><span>الاسم بالإنجليزية</span><input name="nameEn" maxlength="80" dir="ltr" value="${esc(e.nameEn)}" autocomplete="off"></label>
            <label class="field"><span>المسمى الوظيفي <b>*</b></span><input name="titleAr" required maxlength="80" value="${esc(e.titleAr)}" autocomplete="off"></label>
            <label class="field"><span>المسمى بالإنجليزية</span><input name="titleEn" maxlength="80" dir="ltr" value="${esc(e.titleEn)}" autocomplete="off"></label>
            <label class="field"><span>القسم / الإدارة</span><input name="department" maxlength="60" value="${esc(e.department)}" autocomplete="off"></label>
            <label class="field"><span>الرقم الوظيفي</span><input name="employeeNo" maxlength="24" dir="ltr" placeholder="تلقائي — GEC-001" value="${esc(e.employeeNo)}" autocomplete="off"><small>اتركه فارغاً ليُولَّد تلقائياً.</small></label>
            <label class="field"><span>تاريخ الانضمام</span><input name="joinedOn" type="date" value="${esc(e.joinedOn)}"></label>
            <div class="field"><span>نمط البطاقة</span>
              <div class="theme-pick">
                <label><input type="radio" name="theme" value="forest" ${e.theme !== "noir" ? "checked" : ""}><span class="sw forest"></span> الأخضر المؤسسي</label>
                <label><input type="radio" name="theme" value="noir" ${e.theme === "noir" ? "checked" : ""}><span class="sw noir"></span> الأسود والذهبي</label>
              </div>
            </div>
          </div>
        </section>

        <section class="fset">
          <h3>التواصل والموقع</h3>
          <div class="fgrid">
            <label class="field"><span>رقم الجوال</span><input name="phone" type="tel" dir="ltr" maxlength="30" placeholder="+965 9223 2178" value="${esc(e.phone)}" autocomplete="off"></label>
            <label class="field"><span>رقم واتساب</span><input name="whatsapp" type="tel" dir="ltr" maxlength="30" placeholder="اتركه فارغاً لاستخدام الجوال" value="${esc(e.whatsapp)}" autocomplete="off"></label>
            <label class="field"><span>البريد الإلكتروني</span><input name="email" type="email" dir="ltr" maxlength="120" value="${esc(e.email)}" autocomplete="off"></label>
            <label class="field"><span>الموقع الإلكتروني</span><input name="website" type="url" dir="ltr" maxlength="500" placeholder="example.com" value="${esc(e.website)}" autocomplete="off"></label>
            <label class="field full"><span>اللوكيشن / العنوان</span><input name="location" maxlength="140" placeholder="المرقاب، مدينة الكويت" value="${esc(e.location)}" autocomplete="off"></label>
            <label class="field full"><span>رابط اللوكيشن على الخريطة</span><input name="mapUrl" type="url" dir="ltr" maxlength="500" placeholder="https://maps.app.goo.gl/..." value="${esc(e.mapUrl)}" autocomplete="off"><small>اتركه فارغاً ليُفتح اللوكيشن على خرائط Google تلقائياً.</small></label>
          </div>
          <label class="switch"><input type="checkbox" name="showPhone" ${e.showPhone !== false ? "checked" : ""}><span class="track"></span><span class="txt"><b>إظهار الجوال وواتساب</b><small>يظهران كأزرار اتصال وواتساب داخل البطاقة.</small></span></label>
          <label class="switch"><input type="checkbox" name="showEmail" ${e.showEmail !== false ? "checked" : ""}><span class="track"></span><span class="txt"><b>إظهار البريد الإلكتروني</b><small>يظهر كزر بريد داخل البطاقة.</small></span></label>
        </section>

        <section class="fset">
          <h3>الحسابات وروابط التواصل</h3>
          <div class="fgrid">
            <label class="field"><span>X (تويتر)</span><input name="xUrl" dir="ltr" maxlength="500" placeholder="@username أو الرابط" value="${esc(e.xUrl)}" autocomplete="off"></label>
            <label class="field"><span>إنستغرام</span><input name="instagramUrl" dir="ltr" maxlength="500" placeholder="@username أو الرابط" value="${esc(e.instagramUrl)}" autocomplete="off"></label>
            <label class="field"><span>لينكدإن</span><input name="linkedinUrl" dir="ltr" maxlength="500" placeholder="اسم المستخدم أو الرابط" value="${esc(e.linkedinUrl)}" autocomplete="off"></label>
            <label class="field"><span>سناب شات</span><input name="snapchatUrl" dir="ltr" maxlength="500" placeholder="@username أو الرابط" value="${esc(e.snapchatUrl)}" autocomplete="off"></label>
            <label class="field"><span>تيك توك</span><input name="tiktokUrl" dir="ltr" maxlength="500" placeholder="@username أو الرابط" value="${esc(e.tiktokUrl)}" autocomplete="off"></label>
            <label class="field"><span>فيسبوك</span><input name="facebookUrl" dir="ltr" maxlength="500" placeholder="اسم الصفحة أو الرابط" value="${esc(e.facebookUrl)}" autocomplete="off"></label>
          </div>
          <p class="hint">يمكنك كتابة اسم المستخدم فقط مثل @sara، أو لصق رابط الحساب الكامل.</p>
        </section>

        <section class="fset">
          <h3>الصورة الشخصية</h3>
          <div class="photo-row">
            <div class="photo-prev" id="photoPrev">${photo}</div>
            <div class="photo-btns">
              <div class="row"><button type="button" class="btn small" id="photoPick">اختيار صورة</button><button type="button" class="btn small" id="photoClear">إزالة</button></div>
              <p class="hint">JPG أو PNG. تُقص مربعة وتُضغط تلقائياً حتى تفتح البطاقة بسرعة.</p>
            </div>
          </div>
          <input type="file" id="photoFile" accept="image/jpeg,image/png,image/webp" hidden>
        </section>

        <section class="fset">
          <h3>النشر</h3>
          <label class="switch"><input type="checkbox" name="visible" ${e.visible !== false ? "checked" : ""}><span class="track"></span><span class="txt"><b>إظهار البطاقة عند مسح رمز QR</b><small>عند الإخفاء يظهر للزائر «البطاقة غير متاحة»، ويبقى كل شيء قابلاً للتعديل.</small></span></label>
        </section>

        <div class="err" id="formErr" role="alert"></div>
        <div class="actions">
          <button type="button" class="btn" data-close>إلغاء</button>
          <button type="submit" class="btn primary" id="saveBtn">${isEdit ? "حفظ التعديلات" : "حفظ البطاقة"}</button>
        </div>
      </form>
    </div>
  </aside>`;

  const form = $("#empForm");
  const preview = $("#formPreview");
  const updatePreview = () => {
    const fd = new FormData(form);
    preview.className = `mini theme-${fd.get("theme") === "noir" ? "noir" : "forest"}`;
    $('[data-pv="name"]', preview).textContent = String(fd.get("nameAr") || "").trim() || "اسم الموظف";
    $('[data-pv="title"]', preview).textContent = String(fd.get("titleAr") || "").trim() || "المسمى الوظيفي";
    $('[data-pv="dept"]', preview).textContent = String(fd.get("department") || "").trim() || "القسم / الإدارة";
    $('[data-pv="no"]', preview).textContent = String(fd.get("employeeNo") || "").trim().toUpperCase() || "GEC-000";
    const pv = $('[data-pv="photo"]', preview);
    pv.innerHTML = S.photo ? `<img src="${esc(S.photo)}" alt="">` : esc(initials(fd.get("nameAr")) || "؟");
  };
  form.addEventListener("input", updatePreview);
  form.addEventListener("change", updatePreview);

  const setPhoto = (data) => {
    S.photo = data || "";
    $("#photoPrev").innerHTML = S.photo ? `<img src="${esc(S.photo)}" alt="">` : esc(initials(form.elements.nameAr.value) || "؟");
    updatePreview();
  };
  $("#photoPick").onclick = () => $("#photoFile").click();
  $("#photoClear").onclick = () => setPhoto("");
  $("#photoFile").onchange = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    try {
      const data = await compressPhoto(file);
      setPhoto(data);
      toast("تم تجهيز الصورة.");
    } catch (err) {
      toast(err === "too_big" ? "الصورة كبيرة جداً. اختر صورة أقل من 12 ميجابايت." : "تعذّر قراءة الصورة. جرّب JPG أو PNG.");
    }
  };

  bindClose($("#drawerRoot"), () => { $("#drawerRoot").innerHTML = ""; S.editing = null; S.photo = ""; });

  form.onsubmit = async (ev) => {
    ev.preventDefault();
    if (S.busy) return;
    const fd = new FormData(form);
    const nameAr = String(fd.get("nameAr") || "").trim();
    const titleAr = String(fd.get("titleAr") || "").trim();
    if (nameAr.length < 2) return showFormError("اكتب اسم الموظف.");
    if (titleAr.length < 2) return showFormError("اكتب المسمى الوظيفي.");
    const payload = {
      action: isEdit ? "update" : "create",
      id: isEdit ? e.id : undefined,
      nameAr,
      nameEn: String(fd.get("nameEn") || "").trim(),
      titleAr,
      titleEn: String(fd.get("titleEn") || "").trim(),
      department: String(fd.get("department") || "").trim(),
      employeeNo: String(fd.get("employeeNo") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      whatsapp: String(fd.get("whatsapp") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      website: String(fd.get("website") || "").trim(),
      location: String(fd.get("location") || "").trim(),
      mapUrl: String(fd.get("mapUrl") || "").trim(),
      xUrl: String(fd.get("xUrl") || "").trim(),
      instagramUrl: String(fd.get("instagramUrl") || "").trim(),
      linkedinUrl: String(fd.get("linkedinUrl") || "").trim(),
      snapchatUrl: String(fd.get("snapchatUrl") || "").trim(),
      tiktokUrl: String(fd.get("tiktokUrl") || "").trim(),
      facebookUrl: String(fd.get("facebookUrl") || "").trim(),
      joinedOn: String(fd.get("joinedOn") || ""),
      photo: S.photo,
      theme: fd.get("theme") === "noir" ? "noir" : "forest",
      visible: form.elements.visible.checked,
      showPhone: form.elements.showPhone.checked,
      showEmail: form.elements.showEmail.checked,
    };
    S.busy = true;
    const save = $("#saveBtn");
    save.disabled = true;
    save.textContent = "جاري الحفظ…";
    $("#formErr").textContent = "";
    try {
      const r = await api("/crm/api/employees", { method: "POST", body: payload });
      if (isEdit) {
        const i = S.employees.findIndex((x) => x.id === r.employee.id);
        if (i >= 0) S.employees[i] = r.employee;
      } else {
        S.employees.unshift(r.employee);
      }
      $("#drawerRoot").innerHTML = "";
      S.editing = null;
      S.photo = "";
      render();
      toast(isEdit ? "تم حفظ التعديلات." : `تم إنشاء بطاقة ${r.employee.nameAr} برقم ${r.employee.employeeNo}.`);
    } catch (err) {
      if (err.status === 401) return authScreen("login", "انتهت الجلسة، سجّل الدخول مرة أخرى.");
      showFormError(errText(err));
      save.disabled = false;
      save.textContent = isEdit ? "حفظ التعديلات" : "حفظ البطاقة";
    } finally {
      S.busy = false;
    }
  };
}

function showFormError(msg) {
  const el = $("#formErr");
  if (!el) return toast(msg);
  el.textContent = msg;
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/** Square-crop and compress in the browser; the API only accepts small data URLs. */
async function compressPhoto(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw "bad_type";
  if (file.size > 12 * 1024 * 1024) throw "too_big";
  let source = null;
  let objectUrl = "";
  if (typeof createImageBitmap === "function") {
    try { source = await createImageBitmap(file); } catch {}
  }
  if (!source) {
    objectUrl = URL.createObjectURL(file);
    try {
      source = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject("decode");
        img.src = objectUrl;
      });
    } catch {
      URL.revokeObjectURL(objectUrl);
      throw "bad_type";
    }
  }
  const size = 560;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  const sw = source.width || source.naturalWidth;
  const sh = source.height || source.naturalHeight;
  const scale = Math.max(size / sw, size / sh);
  const w = sw * scale;
  const h = sh * scale;
  ctx.drawImage(source, (size - w) / 2, (size - h) / 2, w, h);
  source.close?.();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  let quality = 0.84;
  let data = canvas.toDataURL("image/jpeg", quality);
  while (data.length > 260_000 && quality > 0.46) {
    quality -= 0.08;
    data = canvas.toDataURL("image/jpeg", quality);
  }
  if (data.length > 380_000) throw "too_big";
  return data;
}

/* ---------- Close helpers ---------- */
function bindClose(root, after) {
  $$("[data-close]", root).forEach((b) => b.addEventListener("click", () => { root.innerHTML = ""; after?.(); }));
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if ($("#modalRoot").innerHTML) { $("#modalRoot").innerHTML = ""; return; }
  if ($("#drawerRoot").innerHTML) { $("#drawerRoot").innerHTML = ""; S.editing = null; S.photo = ""; }
});

/* ---------- QR modal ---------- */
function openQr(e) {
  const url = cardUrl(e.publicId);
  $("#modalRoot").innerHTML = `
  <div class="modal-scrim" data-close></div>
  <div class="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qrTitle">
    <button class="x" type="button" data-close aria-label="إغلاق">×</button>
    <h3 id="qrTitle">${esc(e.nameAr)}</h3>
    <p class="sub">${esc(e.employeeNo)} · ${esc(e.titleAr)}</p>
    <div class="qr-frame"><div id="qrBig" aria-label="رمز QR"></div></div>
    <div class="qr-url"><input id="qrUrl" readonly value="${esc(url)}" aria-label="رابط البطاقة"><button type="button" id="copyQr">نسخ</button></div>
    <div class="actions">
      <button class="btn" type="button" id="dlQr">${icon("qr")} تحميل PNG</button>
      <button class="btn" type="button" id="openCard">فتح البطاقة</button>
      <button class="btn primary wide" type="button" id="printCard">${icon("print")} طباعة البطاقة</button>
    </div>
    ${e.visible ? "" : `<p class="hidden-note">البطاقة مخفية حالياً؛ رمز QR لن يعمل حتى تفعّل «إظهار البطاقة».</p>`}
  </div>`;

  new QRCode($("#qrBig"), {
    text: url, width: 512, height: 512,
    colorDark: "#0E2B16", colorLight: "#FFFFFF", correctLevel: QRCode.CorrectLevel.H,
  });

  bindClose($("#modalRoot"));
  $("#copyQr").onclick = async () => {
    try { await navigator.clipboard.writeText(url); toast("تم نسخ الرابط."); }
    catch { $("#qrUrl").select(); toast("حدّد الرابط وانسخه يدوياً."); }
  };
  $("#openCard").onclick = () => window.open(url, "_blank", "noopener");
  $("#dlQr").onclick = () => downloadQr(e);
  $("#printCard").onclick = () => { $("#modalRoot").innerHTML = ""; printCard(e); };
}

function downloadQr(e) {
  const host = $("#qrBig");
  const canvas = host?.querySelector("canvas");
  const img = host?.querySelector("img");
  const data = canvas ? canvas.toDataURL("image/png") : img?.src;
  if (!data) return toast("لم يكتمل توليد الرمز بعد. حاول مرة أخرى.");
  const a = document.createElement("a");
  a.href = data;
  a.download = `QR-${e.employeeNo}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------- Delete ---------- */
function confirmDelete(e) {
  $("#modalRoot").innerHTML = `
  <div class="modal-scrim" data-close></div>
  <div class="qr-modal" role="dialog" aria-modal="true" aria-labelledby="delTitle">
    <button class="x" type="button" data-close aria-label="إغلاق">×</button>
    <h3 id="delTitle">حذف بطاقة ${esc(e.nameAr)}؟</h3>
    <p class="sub">سيُحذف الموظف ورابط QR نهائياً. لا يمكن التراجع.</p>
    <div class="actions">
      <button class="btn" type="button" data-close>إلغاء</button>
      <button class="btn" type="button" id="confirmDel" style="background:var(--danger);border-color:var(--danger);color:#fff">حذف البطاقة</button>
    </div>
  </div>`;
  bindClose($("#modalRoot"));
  $("#confirmDel").onclick = async (ev) => {
    const b = ev.currentTarget;
    b.disabled = true;
    b.textContent = "جاري الحذف…";
    try {
      await api("/crm/api/employees", { method: "POST", body: { action: "delete", id: e.id } });
      S.employees = S.employees.filter((x) => x.id !== e.id);
      $("#modalRoot").innerHTML = "";
      render();
      toast("تم حذف البطاقة.");
    } catch (err) {
      toast(errText(err));
      b.disabled = false;
      b.textContent = "حذف البطاقة";
    }
  };
}

/* ---------- Print ---------- */
let logoCache = "";
async function logoDataUrl() {
  if (logoCache) return logoCache;
  const r = await fetch("/gec-logo.png", { cache: "force-cache" });
  if (!r.ok) throw new Error("logo");
  const blob = await r.blob();
  logoCache = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
  return logoCache;
}

function makeQrDataUrl(text, size = 600) {
  return new Promise((resolve, reject) => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(host);
    new QRCode(host, {
      text, width: size, height: size,
      colorDark: "#0E2B16", colorLight: "#FFFFFF", correctLevel: QRCode.CorrectLevel.H,
    });
    setTimeout(() => {
      const canvas = host.querySelector("canvas");
      const data = canvas ? canvas.toDataURL("image/png") : host.querySelector("img")?.src;
      host.remove();
      data ? resolve(data) : reject(new Error("qr"));
    }, 80);
  });
}

function printHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
function printHandle(url) {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    const last = decodeURIComponent(path.split("/").filter(Boolean).pop() || "").replace(/^@+/, "");
    return last || printHost(url);
  } catch { return url; }
}

async function printCard(e) {
  let qr;
  try { qr = await makeQrDataUrl(cardUrl(e.publicId)); }
  catch { return toast("تعذّر توليد رمز QR للطباعة."); }
  const logo = await logoDataUrl().catch(() => `${CARD_ORIGIN}/gec-logo.png`);

  const photo = e.photo ? `<img src="${esc(e.photo)}" alt="">` : esc(initials(e.nameAr));
  const socialLine = (label, url, at = false) => url
    ? `<span><b>${label}</b><span dir="ltr">${at ? "@" : ""}${esc(printHandle(url))}</span></span>`
    : "";
  const backRows = [
    `<span><b>الرقم</b><span dir="ltr">${esc(e.employeeNo)}</span></span>`,
    e.phone ? `<span><b>الجوال</b><span dir="ltr">${esc(e.phone)}</span></span>` : "",
    (e.whatsapp || e.phone) ? `<span><b>واتساب</b><span dir="ltr">${esc(e.whatsapp || e.phone)}</span></span>` : "",
    e.email ? `<span><b>البريد</b><span dir="ltr">${esc(e.email)}</span></span>` : "",
    e.website ? `<span><b>الموقع</b><span dir="ltr">${esc(printHost(e.website))}</span></span>` : "",
    e.location ? `<span><b>اللوكيشن</b><span>${esc(e.location)}</span></span>` : "",
    socialLine("X", e.xUrl, true),
    socialLine("إنستغرام", e.instagramUrl, true),
    socialLine("لينكدإن", e.linkedinUrl),
    socialLine("سناب", e.snapchatUrl, true),
    socialLine("تيك توك", e.tiktokUrl, true),
    socialLine("فيسبوك", e.facebookUrl),
  ].filter(Boolean).join("");

  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>${esc(e.employeeNo)} — ${esc(e.nameAr)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Tajawal:wght@400;500;700;800&family=Inter:wght@500;600&display=swap" rel="stylesheet">
<style>
  @page{size:54mm 85.6mm;margin:0}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{margin:0;padding:0;background:#fff}
  .screen-bar{display:none}
  .sheet{width:54mm;height:85.6mm;position:relative;overflow:hidden;page-break-after:always;break-after:page}
  .sheet:last-child{page-break-after:auto;break-after:auto}
  .front{background:linear-gradient(160deg,#0B2B16,#164A25 70%,#08200F);color:#F7F1E1;font-family:Tajawal,sans-serif;padding:3mm;display:flex;flex-direction:column;align-items:center;text-align:center}
  .front.noir{background:linear-gradient(160deg,#0A0A08,#1C1A14 70%,#050504)}
  .front::after{content:"";position:absolute;inset:1.2mm;border:.22mm solid rgba(231,199,122,.5);border-radius:2mm;pointer-events:none}
  .f-logo{width:23mm;height:14.5mm;background:#FBF8EE;border-radius:1.6mm;display:flex;align-items:center;justify-content:center;border:.2mm solid rgba(231,199,122,.5);position:relative;z-index:1}
  .f-logo img{width:19mm;max-height:11.5mm;object-fit:contain;display:block}
  .f-company{font-size:2mm;color:#E7C77A;font-weight:700;margin-top:.8mm;position:relative;z-index:1}
  .f-kind{font-size:1.45mm;letter-spacing:.12em;color:rgba(247,241,225,.65);margin-top:.2mm;position:relative;z-index:1}
  .photo{width:17mm;height:17mm;border-radius:50%;overflow:hidden;border:.35mm solid #E7C77A;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:5.2mm;font-weight:700;color:#E7C77A;margin-top:2mm;position:relative;z-index:1}
  .photo img{width:100%;height:100%;object-fit:cover;display:block}
  .front h1{font-family:"Aref Ruqaa",Tajawal,serif;font-size:4.1mm;line-height:1.35;margin:1.2mm 0 0;color:#FBF8EC;position:relative;z-index:1;max-width:100%;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .en{font-family:Inter,sans-serif;font-size:1.55mm;color:rgba(247,241,225,.7);margin:.2mm 0 0;position:relative;z-index:1;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .role{font-size:2.2mm;color:#E7C77A;font-weight:700;margin:.8mm 0 0;position:relative;z-index:1;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .role-en{font-family:Inter,sans-serif;font-size:1.4mm;color:rgba(247,241,225,.62);margin:.1mm 0 0;position:relative;z-index:1;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dept{display:inline-block;margin-top:.9mm;padding:.4mm 1.5mm;border:.2mm solid rgba(231,199,122,.35);border-radius:2mm;font-size:1.55mm;color:#E7C77A;position:relative;z-index:1;max-width:46mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .f-qr{width:15mm;height:15mm;background:#fff;border-radius:1mm;padding:.8mm;margin-top:auto;position:relative;z-index:1}
  .f-qr img{width:100%;height:100%;display:block}
  .f-no{font-family:Inter,sans-serif;font-size:2mm;color:#E7C77A;letter-spacing:.06em;direction:ltr;margin-top:.8mm;position:relative;z-index:1}
  .back{background:#FAFAF7;color:#1A1A18;font-family:Tajawal,sans-serif;padding:3mm;border:.2mm solid #E8E8E5;display:flex;flex-direction:column}
  .b-head{display:flex;align-items:center;justify-content:space-between;border-bottom:.3mm solid #C9A227;padding-bottom:1.2mm;margin-bottom:1.6mm}
  .b-head img{height:6mm;width:auto}
  .b-head b{font-size:2.1mm;color:#2D5F2D}
  .b-title{font-size:1.9mm;font-weight:700;color:#1B4A26;margin:0 0 .8mm}
  .b-name{font-size:2.5mm;font-weight:800;color:#1A1A18;margin:0 0 1.2mm;line-height:1.3}
  .b-lines{display:flex;flex-direction:column;gap:.7mm;font-size:1.75mm;color:#4A4A46;line-height:1.35}
  .b-lines span{display:flex;gap:1mm}
  .b-lines b{color:#1A1A18;font-weight:600;min-width:7mm;flex:none}
  .b-lines span span{min-width:0;overflow-wrap:anywhere}
  .b-note{margin-top:auto;font-size:1.25mm;color:#6C6C67;line-height:1.35;border-top:.2mm dashed #D0D0CC;padding-top:.8mm}
  .b-note strong{color:#2D5F2D}
  @media screen{body{background:#e9e9e5;padding:8mm}.sheet{margin:0 auto 6mm;box-shadow:0 3mm 8mm rgba(0,0,0,.18)}.screen-bar{display:flex;gap:10px;align-items:center;justify-content:center;margin:0 auto 6mm;font:14px Tajawal,sans-serif}.screen-bar button{font:inherit;padding:8px 18px;border:0;border-radius:6px;background:#1B4A26;color:#fff;cursor:pointer}}
  @media print{.screen-bar{display:none}}
</style></head>
<body>
<div class="screen-bar"><button type="button" onclick="window.print()">طباعة</button><span>بطاقة طولية 54 × 85.6 مم — اختر الصفحتين من نافذة الطباعة.</span></div>
<div class="sheet front ${e.theme === "noir" ? "noir" : ""}">
  <div class="f-logo"><img src="${logo}" alt="GEC"></div>
  <div class="f-company">شركة البيئة الخضراء</div>
  <div class="f-kind">بطاقة موظف · EMPLOYEE ID</div>
  <div class="photo">${photo}</div>
  <h1>${esc(e.nameAr)}</h1>
  ${e.nameEn ? `<p class="en">${esc(e.nameEn)}</p>` : ""}
  <p class="role">${esc(e.titleAr)}</p>
  ${e.titleEn ? `<p class="role-en">${esc(e.titleEn)}</p>` : ""}
  ${e.department ? `<span class="dept">${esc(e.department)}</span>` : ""}
  <div class="f-qr"><img src="${qr}" alt="QR"></div>
  <div class="f-no">${esc(e.employeeNo)}</div>
</div>
<div class="sheet back">
  <div class="b-head"><img src="${logo}" alt="GEC"><b>شركة البيئة الخضراء</b></div>
  <p class="b-title">بطاقة تعريف موظف</p>
  <div class="b-name">${esc(e.nameAr)}</div>
  <div class="b-lines">${backRows}</div>
  <div class="b-note"><strong>هذه البطاقة ملك لشركة البيئة الخضراء.</strong> عند العثور عليها يرجى تسليمها إلى مكتب الاستقبال أو الاتصال على 22245887. برج مزايا 1، الدور 15، المرقاب، مدينة الكويت.</div>
</div>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return toast("اسمح للنوافذ المنبثقة لطباعة البطاقة.");
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try { w.focus(); w.print(); } catch {}
  };
  w.addEventListener("load", () => setTimeout(doPrint, 450));
  setTimeout(doPrint, 1400);
}

/* ---------- Start ---------- */
bindHeader();
bindGrid();
boot();
