import { db, ensureSchema } from "./db.js";

let cache = null;

/** The establishment directory {sectors, leads}, read once per function instance. */
export async function directory() {
  if (cache) return cache;
  await ensureSchema();
  const [row] = await db()`select data from directory where id = 1`;
  if (!row) throw Object.assign(new Error("directory missing"), { code: "no_directory" });
  const data = row.data;
  cache = { data, ids: new Set(data.leads.map((l) => l.id)) };
  return cache;
}
