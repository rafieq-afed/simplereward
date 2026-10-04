import { Role } from "@prisma/client";

export default defineEventHandler(async (event) => {
  await requireSession(event, Role.MERCHANT);
  clearStaffSession(event);
  return { ok: true };
});
