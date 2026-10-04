export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 404, statusMessage: "Shop not found" });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { slug },
    select: {
      name: true,
      slug: true,
      welcomeNote: true,
      requireJoinOtp: true,
      brandColor: true,
      logoUrl: true,
      cardTheme: true,
      fontFamily: true,
      instagramUrl: true,
      facebookUrl: true,
      tiktokUrl: true,
      whatsappUrl: true,
      features: true,
      campaigns: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!merchant) {
    throw createError({ statusCode: 404, statusMessage: "Shop not found" });
  }

  const campaigns = merchant.campaigns.map(serializeCampaign);
  const primary = campaigns[0];
  const features = normalizeFeatures(merchant.features);
  const socialOk = hasFeature(features, "socialLinks");

  return {
    merchant: {
      name: merchant.name,
      slug: merchant.slug,
      welcomeNote: merchant.welcomeNote,
      requireJoinOtp: merchant.requireJoinOtp && hasFeature(features, "joinOtp"),
      brandColor: merchant.brandColor,
      logoUrl: hasFeature(features, "brandKit") ? merchant.logoUrl : null,
      cardTheme: hasFeature(features, "brandKit") ? merchant.cardTheme : "classic",
      fontFamily: hasFeature(features, "brandKit") ? merchant.fontFamily : "syne",
      instagramUrl: socialOk ? merchant.instagramUrl : null,
      facebookUrl: socialOk ? merchant.facebookUrl : null,
      tiktokUrl: socialOk ? merchant.tiktokUrl : null,
      whatsappUrl: socialOk ? merchant.whatsappUrl : null,
      features: {
        birthdayBonus: hasFeature(features, "birthdayBonus"),
        walletPass: hasFeature(features, "walletPass"),
      },
      stampGoal: primary?.goal ?? 10,
      rewardLabel: primary?.rewardLabel ?? "Free item",
      campaignType: primary?.type ?? "STAMP",
      campaign: primary?.campaign ?? campaignCopy("STAMP"),
    },
    campaigns,
  };
});
