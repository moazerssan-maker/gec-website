// Email drafts for one establishment. Three intro angles chosen by ISIC
// division (heavy / medium / light), plus two short follow-ups.
// Wording rules: formal but human, no exclamation marks, subject < 50 chars,
// no invented legal article numbers.

export const SENDER = {
  company: "Green Environment Consultancy (GEC)",
  tel: "22245887 / 92232178",
  email: "info@envo-green.com",
  web: "envo-green.com",
  address: "مدينة الكويت، المرقاب، شارع خالد بن الوليد، برج مزايا 1، الدور 15",
};

const HEAVY = new Set(["06", "08", "09", "19", "20", "21", "23", "24", "38", "15"]);
const MEDIUM = new Set(["10", "11", "13", "16", "17", "18", "22", "25", "28", "29", "30", "31", "35"]);
export const tier = (div) => (HEAVY.has(div) ? "heavy" : MEDIUM.has(div) ? "medium" : "light");
export const TIER_AR = { heavy: "صناعة ثقيلة", medium: "صناعة متوسطة", light: "صناعة خفيفة" };

export const STEPS = [
  { k: "intro", ar: "رسالة تعريف (أولى)" },
  { k: "follow1", ar: "متابعة أولى" },
  { k: "follow2", ar: "متابعة أخيرة" },
];

const clean = (s) => String(s || "").replace(/\s+/g, " ").replace(/[|•]+/g, " ").trim();

function subjectFor(lead, t) {
  const base = { heavy: "التصريح البيئي لمصنعكم", medium: "الالتزام البيئي لمصنعكم", light: "تجديد التصريح البيئي لمنشأتكم" }[t];
  const withArea = lead.areaAr ? `${base} في ${lead.areaAr}` : base;
  return withArea.length < 50 ? withArea : base;
}

function signature(senderName) {
  return [
    "مع خالص التحية،",
    senderName || "",
    SENDER.company,
    `هاتف: ${SENDER.tel}`,
    `${SENDER.email} · ${SENDER.web}`,
    SENDER.address,
  ].filter(Boolean).join("\n");
}

const bullets = (items) => items.map((x) => `• ${x}`).join("\n");

/** Build {to, subject, body} for one establishment and step. */
export function buildEmail(lead, track, step, senderName) {
  const t = tier(lead.div);
  const contact = (track && track.contact) || {};
  const to = contact.email || lead.email || "";
  const product = clean(lead.products[0]);
  const activity = product ? `نشاطكم في ${product}` : "نشاطكم الصناعي";
  const where = lead.areaAr ? ` بمنطقة ${lead.areaAr}` : "";
  const services = (lead.services || []).map(clean).filter(Boolean);
  const subject = subjectFor(lead, t);

  const head = [
    `السادة ${lead.name} المحترمين،`,
    contact.name ? `عناية: ${contact.name}${contact.role ? ` — ${contact.role}` : ""}` : "",
    "تحية طيبة وبعد،",
  ].filter(Boolean).join("\n");
  const optOut = "إن لم ترغبوا في تلقي رسائل منا، يكفي الرد بكلمة «إلغاء».";

  if (step === "follow1") {
    return {
      to, subject: `رد: ${subject}`,
      body: [
        head,
        `أعود إلى رسالتي السابقة بخصوص التصريح البيئي لمنشأتكم${lead.areaAr ? ` في ${lead.areaAr}` : ""}. عند تجديد التصريح تطلب الهيئة العامة للبيئة عادةً نتائج رصد بيئي حديثة، وتجهيزها مسبقاً يختصر وقت التجديد.`,
        "إن كان هذا الموضوع من اختصاص شخص آخر لديكم، أكون شاكراً لو دللتموني عليه.",
        signature(senderName),
      ].join("\n\n"),
    };
  }
  if (step === "follow2") {
    return {
      to, subject: `رد: ${subject}`,
      body: [
        head,
        "أكتب للمرة الأخيرة بخصوص التصريح البيئي لمنشأتكم، وسأتوقف عن المراسلة إن لم يكن الوقت مناسباً.",
        "إذا احتجتم لاحقاً إلى مراجعة التصريح أو برنامج الرصد البيئي، يسعدنا التواصل معكم في أي وقت على الأرقام أدناه.",
        signature(senderName),
      ].join("\n\n"),
    };
  }

  const intro = `أتواصل معكم من ${SENDER.company}، مكتب استشارات بيئية في الكويت يعمل مع المصانع على متطلبات الهيئة العامة للبيئة.`;
  let middle;
  if (t === "heavy") {
    middle = [
      `رفعت اللائحة التنفيذية لقانون حماية البيئة متطلبات الرصد البيئي وإدارة النفايات الخطرة على المنشآت الصناعية، ومنها ${activity}${where}. وكثير من التصاريح القائمة صدرت قبل هذه المتطلبات، فتحتاج إلى تحديث عند التجديد.`,
      `ما نراه مناسباً لمنشأتكم:\n${bullets(services)}`,
      "نقترح زيارة مجانية لمدة 30 دقيقة بعنوان «فحص جاهزية التصريح البيئي»، نراجع فيها وضع التصريح الحالي ونوضح ما يلزم قبل موعد التجديد، دون أي التزام من طرفكم.",
      "هل يناسبكم موعد خلال الأسبوع القادم؟ يكفي الرد على هذه الرسالة أو الاتصال بنا على الأرقام أدناه.",
    ];
  } else if (t === "medium") {
    middle = [
      `اطلعنا على ${activity}${where}. كثير من المصانع تتابع إجراءات الهيئة العامة للبيئة بنفسها، من تجديد التصريح إلى تقارير الرصد، وهذا يأخذ من وقت إدارة المصنع.`,
      `نقدم اشتراكاً سنوياً للالتزام البيئي يشمل:\n${bullets(["تجديد التصريح البيئي ومتابعته مع الهيئة", "زيارتي رصد بيئي خلال السنة", "تقرير التزام بيئي سنوي جاهز للتقديم"])}`,
      `ومن الخدمات التي نراها مناسبة لمنشأتكم أيضاً:\n${bullets(services)}`,
      "يسعدنا أن نرسل لكم تفاصيل الاشتراك وتكلفته التقديرية بعد مكالمة قصيرة أو زيارة للمصنع. ما الوقت المناسب لكم؟",
    ];
  } else {
    middle = [
      `اطلعنا على ${activity}${where}. تطلب البنوك والجهات الطارحة للمناقصات بشكل متزايد ما يثبت الالتزام البيئي للمنشأة، مثل تصريح بيئي ساري وملخص للبصمة الكربونية.`,
      `نساعدكم في:\n${bullets(["تجديد التصريح البيئي ومتابعته مع الهيئة العامة للبيئة", "ملخص البصمة الكربونية ومؤشرات الاستدامة (ESG) بصيغة تناسب البنوك والمناقصات", ...services])}`,
      "إذا كان موعد تجديد تصريحكم قريباً، يسعدنا مراجعة وضعه معكم في مكالمة قصيرة دون أي التزام.",
    ];
  }
  return { to, subject, body: [head, intro, ...middle, signature(senderName), optOut].join("\n\n") };
}
