import { CampaignType, Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  step: z.enum(["shop", "reward", "done"]),
  name: z.string().trim().min(2).max(80).optional(),
  brandColor: z.string().max(7).optional().nullable(),
  logoUrl: z.string().max(500).optional().nullable(),
  cardTheme: z.enum(["classic", "bold", "ticket", "soft"]).optional(),
  fontFamily: z
    .enum(["syne", "bricolage", "fraunces", "space-grotesk", "dm-sans"])
    .optional(),
  welcomeNote: z.string().trim().max(255).optional().nullable(),
  // first campaign
  campaignName: z.string().trim().min(2).max(80).optional(),
  campaignType: z.enum(["STAMP", "B1F1", "BUNDLE"]).optional(),
  stampGoal: z.coerce.number().int().min(1).max(50).optional(),
  rewardLabel: z.string().trim().min(2).max(80).optional(),
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid onboarding data" });
  }

  const { features } = await getMerchantFeatures(session.merchantId);

  if (parsed.data.step === "shop") {
    if (!parsed.data.name) {
      throw createError({ statusCode: 400, statusMessage: "Shop name required" });
    }
    if (!hasFeature(features, "brandKit")) {
      if (parsed.data.logoUrl?.trim()) {
        await requireFeature(event, session.merchantId, "brandKit");
      }
      if (parsed.data.cardTheme && parsed.data.cardTheme !== "classic") {
        await requireFeature(event, session.merchantId, "brandKit");
      }
      if (parsed.data.fontFamily && parsed.data.fontFamily !== "syne") {
        await requireFeature(event, session.merchantId, "brandKit");
      }
    }
    const merchant = await prisma.merchant.update({
      where: { id: session.merchantId },
      data: {
        name: parsed.data.name,
        ...(parsed.data.brandColor !== undefined
          ? { brandColor: normalizeBrandColor(parsed.data.brandColor) }
          : {}),
        ...(parsed.data.logoUrl !== undefined
          ? {
              logoUrl: parsed.data.logoUrl?.startsWith("/uploads/")
                ? parsed.data.logoUrl.slice(0, 500)
                : normalizeLogoUrl(parsed.data.logoUrl),
            }
          : {}),
        ...(parsed.data.cardTheme
          ? { cardTheme: normalizeCardTheme(parsed.data.cardTheme) }
          : {}),
        ...(parsed.data.fontFamily
          ? { fontFamily: normalizeBrandFont(parsed.data.fontFamily) }
          : {}),
        ...(parsed.data.welcomeNote !== undefined
          ? { welcomeNote: parsed.data.welcomeNote?.trim() || null }
          : {}),
      },
    });
    return { merchant };
  }

  if (parsed.data.step === "reward") {
    if (
      parsed.data.stampGoal == null ||
      !parsed.data.rewardLabel ||
      !parsed.data.campaignType
    ) {
      throw createError({ statusCode: 400, statusMessage: "Campaign details required" });
    }
    const type = parsed.data.campaignType as CampaignType;
    if (type === "STAMP" && parsed.data.stampGoal < 2) {
      throw createError({ statusCode: 400, statusMessage: "Stamp cards need at least 2" });
    }
    if (type !== "STAMP" && !hasFeature(features, "campaignTypes")) {
      throw createError({
        statusCode: 403,
        statusMessage: "Upgrade required: B1F1 + Bundle",
      });
    }

    const copy = campaignCopy(type);
    const existing = await prisma.campaign.findFirst({
      where: { merchantId: session.merchantId },
      orderBy: { createdAt: "asc" },
    });

    const data = {
      name: parsed.data.campaignName?.trim() || copy.title,
      type,
      goal: parsed.data.stampGoal,
      rewardLabel: parsed.data.rewardLabel,
      welcomeNote: parsed.data.welcomeNote?.trim() || null,
      active: true,
      sortOrder: 0,
    };

    const campaign = existing
      ? await prisma.campaign.update({ where: { id: existing.id }, data })
      : await prisma.campaign.create({
          data: { merchantId: session.merchantId, ...data },
        });

    return { campaign: serializeCampaign(campaign) };
  }

  const active = await prisma.campaign.count({
    where: { merchantId: session.merchantId, active: true },
  });
  if (active < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: "Create a campaign before finishing setup",
    });
  }

  const merchant = await prisma.merchant.update({
    where: { id: session.merchantId },
    data: { onboardedAt: new Date() },
  });

  return { merchant };
});
