import { db, ensureSchema } from "../_lib/db.js";
import { handler, send, body } from "../_lib/session.js";
import { cleanInput, newPublicId, adminCard, isUniqueViolation } from "../_lib/cards.js";

/**
 * Admin-only employee ID cards.
 *
 * GET  /api/crm/employees              -> every card, including hidden ones
 * POST {action:"create", ...fields}
 * POST {action:"update", id, ...fields}
 * POST {action:"visible", id, visible}
 * POST {action:"delete", id}
 */
export default handler(async (req, res) => {
  await ensureSchema();
  const sql = db();

  if (req.method === "GET") {
    const rows = await sql`select * from employees order by created_at desc, id desc`;
    return send(res, 200, { employees: rows.map(adminCard) });
  }
  if (req.method !== "POST") return send(res, 405, { error: "method" });

  const b = body(req);
  const id = Number(b.id);

  if (b.action === "create") {
    const c = cleanInput(b);
    if (!c.ok) return send(res, 400, { error: c.error });
    const v = c.value;

    if (v.employeeNo) {
      const [taken] = await sql`select 1 from employees where employee_no = ${v.employeeNo}`;
      if (taken) return send(res, 409, { error: "employee_no_taken" });
    }

    let row = null;
    for (let attempt = 0; attempt < 4 && !row; attempt++) {
      try {
        // A temporary unique number lets the row be inserted before its serial id
        // is known; it is replaced with GEC-<id> immediately below.
        const pending = `PENDING-${newPublicId()}`;
        const [inserted] = await sql`
          insert into employees
            (public_id, name_ar, name_en, title_ar, title_en, department, employee_no,
             phone, whatsapp, email, website, location, map_url,
             x_url, instagram_url, linkedin_url, snapchat_url, tiktok_url, facebook_url,
             joined_on, photo, visible, show_phone, show_email, theme)
          values
            (${newPublicId()}, ${v.nameAr}, ${v.nameEn}, ${v.titleAr}, ${v.titleEn}, ${v.department},
             ${v.employeeNo || pending}, ${v.phone}, ${v.whatsapp ?? ""}, ${v.email},
             ${v.website ?? ""}, ${v.location ?? ""}, ${v.mapUrl ?? ""},
             ${v.xUrl ?? ""}, ${v.instagramUrl ?? ""}, ${v.linkedinUrl ?? ""},
             ${v.snapchatUrl ?? ""}, ${v.tiktokUrl ?? ""}, ${v.facebookUrl ?? ""},
             ${v.joinedOn || null}, ${v.photo ?? ""},
             ${v.visible ?? true}, ${v.showPhone ?? true}, ${v.showEmail ?? true}, ${v.theme ?? "forest"})
          returning *`;
        row = inserted;
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        if (e.constraint === "employees_employee_no_key") return send(res, 409, { error: "employee_no_taken" });
        // public_id collision: try another random id
      }
    }
    if (!row) return send(res, 500, { error: "server_error" });

    if (!v.employeeNo) {
      const nextNo = await nextEmployeeNo(sql, row.id);
      [row] = await sql`update employees set employee_no = ${nextNo} where id = ${row.id} returning *`;
    }
    return send(res, 200, { employee: adminCard(row) });
  }

  if (!id || id < 1) return send(res, 400, { error: "bad_id" });

  if (b.action === "update") {
    const c = cleanInput(b);
    if (!c.ok) return send(res, 400, { error: c.error });
    const v = c.value;
    try {
      const [row] = await sql`
        update employees set
          name_ar = ${v.nameAr}, name_en = ${v.nameEn},
          title_ar = ${v.titleAr}, title_en = ${v.titleEn},
          department = ${v.department},
          employee_no = coalesce(nullif(${v.employeeNo}, ''), employee_no),
          phone = ${v.phone}, whatsapp = coalesce(${v.whatsapp ?? null}, whatsapp),
          email = ${v.email},
          website = coalesce(${v.website ?? null}, website),
          location = coalesce(${v.location ?? null}, location),
          map_url = coalesce(${v.mapUrl ?? null}, map_url),
          x_url = coalesce(${v.xUrl ?? null}, x_url),
          instagram_url = coalesce(${v.instagramUrl ?? null}, instagram_url),
          linkedin_url = coalesce(${v.linkedinUrl ?? null}, linkedin_url),
          snapchat_url = coalesce(${v.snapchatUrl ?? null}, snapchat_url),
          tiktok_url = coalesce(${v.tiktokUrl ?? null}, tiktok_url),
          facebook_url = coalesce(${v.facebookUrl ?? null}, facebook_url),
          joined_on = ${v.joinedOn || null}, photo = coalesce(${v.photo ?? null}, photo),
          visible = coalesce(${v.visible ?? null}, visible),
          show_phone = coalesce(${v.showPhone ?? null}, show_phone),
          show_email = coalesce(${v.showEmail ?? null}, show_email),
          theme = coalesce(${v.theme ?? null}, theme), updated_at = now()
        where id = ${id}
        returning *`;
      if (!row) return send(res, 404, { error: "not_found" });
      return send(res, 200, { employee: adminCard(row) });
    } catch (e) {
      if (isUniqueViolation(e) && e.constraint === "employees_employee_no_key") {
        return send(res, 409, { error: "employee_no_taken" });
      }
      throw e;
    }
  }

  if (b.action === "visible") {
    const [row] = await sql`
      update employees set visible = ${!!b.visible}, updated_at = now()
      where id = ${id} returning *`;
    if (!row) return send(res, 404, { error: "not_found" });
    return send(res, 200, { employee: adminCard(row) });
  }

  if (b.action === "delete") {
    const rows = await sql`delete from employees where id = ${id} returning id`;
    if (!rows.length) return send(res, 404, { error: "not_found" });
    return send(res, 200, { ok: true });
  }

  return send(res, 400, { error: "unknown_action" });
}, { admin: true });

/** GEC-001, GEC-002… skipping numbers already entered manually. */
async function nextEmployeeNo(sql, id) {
  const base = `GEC-${String(id).padStart(3, "0")}`;
  let candidate = base;
  for (let i = 2; i < 100; i++) {
    const [taken] = await sql`select 1 from employees where employee_no = ${candidate} and id <> ${id}`;
    if (!taken) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}
