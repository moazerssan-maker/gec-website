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
    email: str(b.email, 120).toLowerCase(),
    joinedOn: str(b.joinedOn, 10),
    // Optional fields stay undefined when the caller omits them, so a partial
    // update cannot silently reveal a hidden card or wipe its photo.
    photo: has("photo") ? photoValue(b.photo) : undefined,
    visible: typeof b.visible === "boolean" ? b.visible : undefined,
    showPhone: typeof b.showPhone === "boolean" ? b.showPhone : undefined,
    showEmail: typeof b.showEmail === "boolean" ? b.showEmail : undefined,
    theme: THEMES.has(b.theme) ? b.theme : undefined,
  };
  if (value.nameAr.length < 2) return { ok: false, error: "name_required" };
  if (value.titleAr.length < 2) return { ok: false, error: "title_required" };
  if (!isPhone(value.phone)) return { ok: false, error: "bad_phone" };
  if (!isEmail(value.email)) return { ok: false, error: "bad_email" };
  if (!isDate(value.joinedOn)) return { ok: false, error: "bad_date" };
  if (value.photo === null) return { ok: false, error: "bad_photo" };
  if (value.employeeNo && !/^[A-Z0-9][A-Z0-9._/-]{1,23}$/.test(value.employeeNo)) {
    return { ok: false, error: "bad_employee_no" };
  }
  return { ok: true, value };
}

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
    email: row.email,
    joinedOn: dateOnly(row.joined_on),
    photo: row.photo,
    visible: row.visible,
    showPhone: row.show_phone,
    showEmail: row.show_email,
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
    email: row.show_email ? row.email : "",
    joinedOn: dateOnly(row.joined_on),
    photo: row.photo,
    theme: row.theme,
  };
}

export function isUniqueViolation(error) {
  return error && error.code === "23505";
}
