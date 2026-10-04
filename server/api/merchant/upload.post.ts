import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { Role } from "@prisma/client";

const MAX_BYTES = 1.5 * 1024 * 1024;
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  await requireFeature(event, session.merchantId, "brandKit");

  const form = await readMultipartFormData(event);
  if (!form?.length) {
    throw createError({ statusCode: 400, statusMessage: "No file uploaded" });
  }

  const file = form.find((p) => p.name === "file" && p.data?.length);
  const kind = String(form.find((p) => p.name === "kind")?.data?.toString() || "logo");

  if (!file || !file.filename) {
    throw createError({ statusCode: 400, statusMessage: "File required" });
  }
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 400, statusMessage: "Image must be under 1.5MB" });
  }

  const ext = extname(file.filename).toLowerCase() || ".png";
  if (!ALLOWED.has(ext)) {
    throw createError({ statusCode: 400, statusMessage: "Use JPG, PNG, WEBP, or GIF" });
  }

  if (!["logo", "reward"].includes(kind)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid upload kind" });
  }

  const dir = join(process.cwd(), "public", "uploads", session.merchantId);
  await mkdir(dir, { recursive: true });

  const filename = `${kind}-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
  await writeFile(join(dir, filename), file.data);

  const url = `/uploads/${session.merchantId}/${filename}`;
  return { url, kind };
});
