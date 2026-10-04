import { EventType, Role } from "@prisma/client";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: session.merchantId },
  });
  if (!merchant) {
    throw createError({ statusCode: 404, statusMessage: "Merchant missing" });
  }

  const campaigns = await getActiveCampaigns(merchant.id);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  const day = startOfWeek.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

  const inactiveCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const readyCounts = await Promise.all(
    campaigns.map((c) =>
      prisma.customerCampaign.count({
        where: { campaignId: c.id, progress: { gte: c.goal } },
      }),
    ),
  );
  const readyCount = readyCounts.reduce((a, b) => a + b, 0);

  const [
    customerCount,
    stampsToday,
    redeemsToday,
    stampsWeek,
    redeemsWeek,
    newCustomersWeek,
    inactiveCount,
    recent,
  ] = await Promise.all([
    prisma.customer.count({ where: { merchantId: merchant.id } }),
    prisma.stampEvent.count({
      where: {
        type: EventType.EARN,
        createdAt: { gte: startOfDay },
        customer: { merchantId: merchant.id },
      },
    }),
    prisma.stampEvent.count({
      where: {
        type: EventType.REDEEM,
        createdAt: { gte: startOfDay },
        customer: { merchantId: merchant.id },
      },
    }),
    prisma.stampEvent.count({
      where: {
        type: EventType.EARN,
        createdAt: { gte: startOfWeek },
        customer: { merchantId: merchant.id },
      },
    }),
    prisma.stampEvent.count({
      where: {
        type: EventType.REDEEM,
        createdAt: { gte: startOfWeek },
        customer: { merchantId: merchant.id },
      },
    }),
    prisma.customer.count({
      where: { merchantId: merchant.id, createdAt: { gte: startOfWeek } },
    }),
    prisma.customer.count({
      where: { merchantId: merchant.id, updatedAt: { lt: inactiveCutoff } },
    }),
    prisma.customer.findMany({
      where: { merchantId: merchant.id },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        enrollments: {
          include: { campaign: true },
          where: { campaign: { active: true } },
        },
      },
    }),
  ]);

  const almostThere = campaigns.length
    ? await prisma.customerCampaign.findMany({
        where: {
          OR: campaigns.map((c) => ({
            campaignId: c.id,
            progress: {
              gte: Math.max(1, c.goal - 2),
              lt: c.goal,
            },
          })),
        },
        include: {
          customer: true,
          campaign: true,
        },
        orderBy: { progress: "desc" },
        take: 8,
      })
    : [];

  const features = normalizeFeatures(merchant.features);
  const plan = featuresPayload(features, merchant.quotedPrice);

  const pendingUpgrade = await prisma.upgradeRequest.findFirst({
    where: { merchantId: merchant.id, status: "PENDING" },
    select: { id: true, desiredTier: true, message: true, createdAt: true },
  });

  return {
    merchant: {
      ...merchant,
      features: plan.features,
      quotedPrice: plan.quotedPrice,
      // backwards-compatible defaults from first campaign
      stampGoal: campaigns[0]?.goal ?? 10,
      rewardLabel: campaigns[0]?.rewardLabel ?? "Free item",
      campaignType: campaigns[0]?.type ?? "STAMP",
      doubleStamp: false,
    },
    plan,
    pendingUpgrade,
    campaigns: campaigns.map(serializeCampaign),
    stats: {
      customerCount,
      readyCount,
      stampsToday,
      redeemsToday,
      stampsWeek,
      redeemsWeek,
      newCustomersWeek,
      inactiveCount,
    },
    recent: recent.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      stamps: c.enrollments[0]?.progress ?? 0,
      enrollments: c.enrollments.map((e) => serializeEnrollment(e, e.campaign)),
    })),
    almostThere: almostThere.map((e) => ({
      id: e.customer.id,
      name: e.customer.name,
      phone: e.customer.phone,
      stamps: e.progress,
      campaignId: e.campaignId,
      campaignName: e.campaign.name,
      stampGoal: e.campaign.goal,
    })),
    user: session,
  };
});
