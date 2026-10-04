import { Role } from "@prisma/client";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const query = getQuery(event);
  const q = String(query.q || "").trim();

  const customers = await prisma.customer.findMany({
    where: {
      merchantId: session.merchantId,
      ...(q
        ? {
            OR: [{ phone: { contains: q } }, { name: { contains: q } }],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      enrollments: {
        include: { campaign: true },
        where: { campaign: { active: true } },
      },
    },
  });

  return {
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      birthdayMd: c.birthdayMd,
      stamps: c.enrollments[0]?.progress ?? 0,
      totalRedeemed: c.enrollments.reduce((sum, e) => sum + e.totalRedeemed, 0),
      enrollments: c.enrollments.map((e) => ({
        campaignId: e.campaignId,
        campaignName: e.campaign.name,
        progress: e.progress,
        goal: e.campaign.goal,
        totalRedeemed: e.totalRedeemed,
        type: e.campaign.type,
      })),
    })),
  };
});
