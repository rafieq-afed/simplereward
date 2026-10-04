import { Role } from "@prisma/client";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const campaigns = await prisma.campaign.findMany({
    where: { merchantId: session.merchantId },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return {
    campaigns: campaigns.map(serializeCampaign),
    activeCount: campaigns.filter((c) => c.active).length,
  };
});
