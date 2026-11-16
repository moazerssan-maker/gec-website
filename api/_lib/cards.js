import crypto from "node:crypto";

/**
 * Employee ID cards. Kept separate from session.js because the public card
 * endpoint (api/card.js) needs the row mappers without any auth helpers.
 */
export const THEMES = new Set(["forest", "noir"]);
export const PUBLIC_ID_RE = /^[A-Za-z0-9_-]{8,32}$/;

/** URL-safe, unguessable id used by the QR code. Never derived from the name. */
export function newPublicId() {
  return crypto.randomBytes(9).toString("base64url");
}

const str = (value, max) => String(value ?? "").trim().slice(0, max);
const oneLine = (value, max) => str(value, max).replace(/\s+/g, " ");

export const isEmail = (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
export const isPhone = (value) => !value || /^[+()\d\s.-]{5,30}$/.test(value);
export const isDate = (value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

/** Photos are either a compressed data URL from the browser or an HTTPS URL. */
export function photoValue(value) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (s.length > 400_000) return null;
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) return s;
  if (/^https:\/\/[^\s"'<>]{1,500}$/.test(s)) return s;
  return null;
}

/**
 * Accepts a full http(s) URL, or a platform handle when a base is supplied
 * (for example "sara" -> https://x.com/sara). Returns "" for empty input and
 * null for something that cannot be turned into a safe link.
 */
export function urlValue(value, base = "") {
  let s = oneLine(value, 500);
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) {
    // A slash means the user pasted a path such as "x.com/sara"; a bare word
    // with a social base is treated as a handle.
    if (!base || s.includes("/")) {
      s = `https://${s}`;
    } else {
      const handle = s.replace(/^@+/, "");
      if (!/^[A-Za-z0-9._-]{1,60}$/.test(handle)) return null;
      s = base + encodeURIComponent(handle);
    }
  }
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

const SOCIAL_BASES = {
  xUrl: "https://x.com/",
  instagramUrl: "https://instagram.com/",
  linkedinUrl: "https://www.linkedin.com/in/",
  snapchatUrl: "https://www.snapchat.com/add/",
  tiktokUrl: "https://www.tiktok.com/@",
  facebookUrl: "https://www.facebook.com/",
};

export function dateOnly(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/**
 * Validate a create/update payload. Returns {ok:false, error} with a stable
 * error code the page translates, or {ok:true, value} with trimmed fields.
 */
export function cleanInput(b = {}) {
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const value = {
    nameAr: oneLine(b.nameAr, 80),
    nameEn: oneLine(b.nameEn, 80),
    titleAr: oneLine(b.titleAr, 80),
    titleEn: oneLine(b.titleEn, 80),
    department: oneLine(b.department, 60),
    employeeNo: oneLine(b.employeeNo, 24).toUpperCase(),
    phone: str(b.phone, 30),
    whatsapp: has("whatsapp") ? str(b.whatsapp, 30) : undefined,
    email: str(b.email, 120).toLowerCase(),
    website: has("website") ? urlValue(b.website) : undefined,
    location: has("location") ? oneLine(b.location, 140) : undefined,
    mapUrl: has("mapUrl") ? urlValue(b.mapUrl) : undefined,
    xUrl: has("xUrl") ? urlValue(b.xUrl, SOCIAL_BASES.xUrl) : undefined,
    instagramUrl: has("instagramUrl") ? urlValue(b.instagramUrl, SOCIAL_BASES.instagramUrl) : undefined,
    linkedinUrl: has("linkedinUrl") ? urlValue(b.linkedinUrl, SOCIAL_BASES.linkedinUrl) : undefined,
    snapchatUrl: has("snapchatUrl") ? urlValue(b.snapchatUrl, SOCIAL_BASES.snapchatUrl) : undefined,
    tiktokUrl: has("tiktokUrl") ? urlValue(b.tiktokUrl, SOCIAL_BASES.tiktokUrl) : undefined,
    facebookUrl: has("facebookUrl") ? urlValue(b.facebookUrl, SOCIAL_BASES.facebookUrl) : undefined,
    joinedOn: str(b.joinedOn, 10),
    // Optional fields stay undefined when the caller omits them, so a partial
    // update cannot silently reveal a hidden card or wipe its photo.
    photo: has("photo") ? photoValue(b.photo) : undefined,
    visible: typeof b.visible === "boolean" ? b.visible : undefined,
    showPhone: typeof b.showPhone === "boolean" ? b.showPhone : undefined,
    showEmail: typeof b.showEmail === "boolean" ? b.showEmail : undefined,
    showPhoto: typeof b.showPhoto === "boolean" ? b.showPhoto : undefined,
    theme: THEMES.has(b.theme) ? b.theme : undefined,
  };
  if (value.nameAr.length < 2) return { ok: false, error: "name_required" };
  if (value.titleAr.length < 2) return { ok: false, error: "title_required" };
  if (!isPhone(value.phone)) return { ok: false, error: "bad_phone" };
  if (value.whatsapp !== undefined && !isPhone(value.whatsapp)) return { ok: false, error: "bad_whatsapp" };
  if (!isEmail(value.email)) return { ok: false, error: "bad_email" };
  if (!isDate(value.joinedOn)) return { ok: false, error: "bad_date" };
  if (value.photo === null) return { ok: false, error: "bad_photo" };
  for (const [key, code] of [
    ["website", "bad_website"], ["mapUrl", "bad_map"],
    ["xUrl", "bad_x"], ["instagramUrl", "bad_instagram"], ["linkedinUrl", "bad_linkedin"],
    ["snapchatUrl", "bad_snapchat"], ["tiktokUrl", "bad_tiktok"], ["facebookUrl", "bad_facebook"],
  ]) {
    if (value[key] === null) return { ok: false, error: code };
  }
  if (value.employeeNo && !/^[A-Z0-9][A-Z0-9._/-]{1,23}$/.test(value.employeeNo)) {
    return { ok: false, error: "bad_employee_no" };
  }
  return { ok: true, value };
}

const contactFields = (row) => ({
  website: row.website,
  location: row.location,
  mapUrl: row.map_url,
  xUrl: row.x_url,
  instagramUrl: row.instagram_url,
  linkedinUrl: row.linkedin_url,
  snapchatUrl: row.snapchat_url,
  tiktokUrl: row.tiktok_url,
  facebookUrl: row.facebook_url,
});

/** Everything the staff page needs, including hidden cards and private fields. */
export function adminCard(row) {
  return {
    id: row.id,
    publicId: row.public_id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    department: row.department,
    employeeNo: row.employee_no,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    ...contactFields(row),
    joinedOn: dateOnly(row.joined_on),
    photo: row.photo,
    visible: row.visible,
    showPhone: row.show_phone,
    showEmail: row.show_email,
    showPhoto: row.show_photo,
    theme: row.theme,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The public shape. Contact fields disappear when their switch is off. */
export function publicCard(row) {
  return {
    id: row.public_id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    department: row.department,
    employeeNo: row.employee_no,
    phone: row.show_phone ? row.phone : "",
    whatsapp: row.show_phone ? row.whatsapp : "",
    email: row.show_email ? row.email : "",
    ...contactFields(row),
    joinedOn: dateOnly(row.joined_on),
    photo: row.show_photo ? row.photo : "",
    showPhoto: row.show_photo,
    theme: row.theme,
  };
}

export function isUniqueViolation(error) {
  return error && error.code === "23505";
}
