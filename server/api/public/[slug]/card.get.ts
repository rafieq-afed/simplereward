export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  const phone = normalizePhone(String(getQuery(event).phone || ""));
  const campaignId = String(getQuery(event).campaignId || "");

  if (!slug || phone.length < 6) {
    throw createError({ statusCode: 400, statusMessage: "Phone required" });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { slug },
    include: {
      campaigns: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!merchant) {
    throw createError({ statusCode: 404, statusMessage: "Shop not found" });
  }

  const existing = await prisma.customer.findUnique({
    where: {
      merchantId_phone: {
        merchantId: merchant.id,
        phone,
      },
    },
    include: {
      enrollments: {
        include: { campaign: true },
        where: { campaign: { active: true } },
      },
    },
  });

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Card not found",
      data: { code: "NOT_FOUND" },
    });
  }

  const customer = await issueShowCode(existing.id, merchant.id);
  const expiresInSec = customer.showCodeExpiresAt
    ? Math.max(0, Math.round((customer.showCodeExpiresAt.getTime() - Date.now()) / 1000))
    : 0;

  // Ensure enrollment on all active campaigns (lazy join)
  for (const camp of merchant.campaigns) {
    await ensureEnrollment(customer.id, camp.id);
  }

  const enrollments = await prisma.customerCampaign.findMany({
    where: {
      customerId: customer.id,
      campaign: { active: true },
    },
    include: { campaign: true },
    orderBy: { campaign: { sortOrder: "asc" } },
  });

  const selected =
    enrollments.find((e) => e.campaignId === campaignId) || enrollments[0] || null;

  return {
    customer: {
      name: customer.name,
      phone: customer.phone,
      stamps: selected?.progress ?? 0,
      progress: selected?.progress ?? 0,
      totalRedeemed: selected?.totalRedeemed ?? 0,
      cardCode: customer.cardCode,
      showCode: customer.showCode,
      showCodeExpiresIn: expiresInSec,
      birthdayMd: customer.birthdayMd,
    },
    campaign: selected ? serializeCampaign(selected.campaign) : null,
    enrollments: enrollments.map((e) => serializeEnrollment(e, e.campaign)),
    merchant: {
      name: merchant.name,
      stampGoal: selected?.campaign.goal ?? 10,
      rewardLabel: selected?.campaign.rewardLabel ?? "Free item",
      welcomeNote: merchant.welcomeNote,
      brandColor: merchant.brandColor,
      logoUrl: merchant.logoUrl,
      cardTheme: merchant.cardTheme,
      fontFamily: merchant.fontFamily,
      instagramUrl: merchant.instagramUrl,
      facebookUrl: merchant.facebookUrl,
      tiktokUrl: merchant.tiktokUrl,
      whatsappUrl: merchant.whatsappUrl,
      campaignType: selected?.campaign.type ?? "STAMP",
    },
    campaigns: merchant.campaigns.map(serializeCampaign),
  };
});
