import { Role } from "@prisma/client";

export default defineEventHandler(async (event) => {
  await requireSession(event, Role.ADMIN);

  const status = String(getQuery(event).status || "PENDING");

  const requests = await prisma.upgradeRequest.findMany({
    where: status === "ALL" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      merchant: {
        select: {
          id: true,
          name: true,
          slug: true,
          quotedPrice: true,
          features: true,
        },
      },
    },
  });

  return {
    requests: requests.map((r) => ({
      id: r.id,
      message: r.message,
      desiredTier: r.desiredTier,
      status: r.status,
      createdAt: r.createdAt,
      merchant: {
        id: r.merchant.id,
        name: r.merchant.name,
        slug: r.merchant.slug,
        quotedPrice: r.merchant.quotedPrice,
        features: normalizeFeatures(r.merchant.features),
        enabledCount: enabledFeatureCount(normalizeFeatures(r.merchant.features)),
      },
    })),
  };
});
