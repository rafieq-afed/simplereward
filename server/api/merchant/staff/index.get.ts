import { Role } from "@prisma/client";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const { features } = await getMerchantFeatures(session.merchantId);
  const staffEnabled = hasFeature(features, "staffPin");

  const staff = staffEnabled
    ? await prisma.staff.findMany({
        where: { merchantId: session.merchantId, active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, createdAt: true },
      })
    : [];

  const unlocked = await getStaffSession(event);
  const current =
    unlocked && unlocked.merchantId === session.merchantId
      ? { id: unlocked.id, name: unlocked.name }
      : null;

  return {
    staff,
    required: staffEnabled && staff.length > 0,
    current,
  };
});
