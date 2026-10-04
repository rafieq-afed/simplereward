import { Role } from "@prisma/client";

export default defineEventHandler(async (event) => {
  await requireSession(event, Role.ADMIN);

  const merchants = await prisma.merchant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { customers: true } },
      users: {
        where: { role: Role.MERCHANT },
        select: { email: true, name: true },
        take: 1,
      },
      upgradeRequests: {
        where: { status: "PENDING" },
        select: { id: true },
      },
      campaigns: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { goal: true, rewardLabel: true },
      },
    },
  });

  return {
    merchants: merchants.map((m) => {
      const features = normalizeFeatures(m.features);
      return {
        id: m.id,
        name: m.name,
        slug: m.slug,
        stampGoal: m.campaigns[0]?.goal ?? 10,
        rewardLabel: m.campaigns[0]?.rewardLabel ?? "Free item",
        features,
        quotedPrice: m.quotedPrice ?? priceFor(features),
        enabledCount: enabledFeatureCount(features),
        pendingUpgrades: m.upgradeRequests.length,
        _count: m._count,
        users: m.users,
      };
    }),
    catalog: FEATURE_CATALOG,
    templates: TIER_TEMPLATES.map((t) => ({
      ...t,
      suggestedPrice: tierSuggestedPrice(t.id),
    })),
  };
});
