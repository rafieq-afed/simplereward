import { Role } from "@prisma/client";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Staff id required" });
  }

  const row = await prisma.staff.findFirst({
    where: { id, merchantId: session.merchantId, active: true },
  });
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "Staff not found" });
  }

  await prisma.staff.update({
    where: { id },
    data: { active: false },
  });

  const unlocked = await getStaffSession(event);
  if (unlocked?.id === id) {
    clearStaffSession(event);
  }

  return { ok: true };
});
