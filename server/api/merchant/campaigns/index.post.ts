import { CampaignType, Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(["STAMP", "B1F1", "BUNDLE"]).default("STAMP"),
  goal: z.coerce.number().int().min(1).max(50),
  rewardLabel: z.string().trim().min(2).max(80),
  welcomeNote: z.string().trim().max(255).optional().nullable(),
  brandColor: z.string().max(7).optional().nullable(),
  rewardImageUrl: z.string().max(500).optional().nullable(),
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid campaign" });
  }

  if (parsed.data.type === "STAMP" && parsed.data.goal < 2) {
    throw createError({ statusCode: 400, statusMessage: "Stamp cards need at least 2" });
  }

  const { features, limits } = await getMerchantFeatures(session.merchantId);
  if (parsed.data.type !== "STAMP" && !hasFeature(features, "campaignTypes")) {
    throw createError({
      statusCode: 403,
      statusMessage: "Upgrade required: B1F1 + Bundle",
    });
  }
  if (parsed.data.rewardImageUrl?.trim() && !hasFeature(features, "brandKit")) {
    await requireFeature(event, session.merchantId, "brandKit");
  }

  const activeCount = await prisma.campaign.count({
    where: { merchantId: session.merchantId, active: true },
  });
  if (activeCount >= limits.maxActiveCampaigns) {
    throw createError({
      statusCode: 400,
      statusMessage: `Max ${limits.maxActiveCampaigns} active campaign${limits.maxActiveCampaigns === 1 ? "" : "s"} on your plan`,
    });
  }

  const brandColor =
    parsed.data.brandColor === undefined
      ? null
      : normalizeBrandColor(parsed.data.brandColor);

  let rewardImageUrl: string | null = null;
  if (parsed.data.rewardImageUrl?.trim()) {
    const raw = parsed.data.rewardImageUrl.trim();
    rewardImageUrl = raw.startsWith("/uploads/")
      ? raw.slice(0, 500)
      : normalizeLogoUrl(raw);
  }

  const campaign = await prisma.campaign.create({
    data: {
      merchantId: session.merchantId,
      name: parsed.data.name,
      type: parsed.data.type as CampaignType,
      goal: parsed.data.goal,
      rewardLabel: parsed.data.rewardLabel,
      welcomeNote: parsed.data.welcomeNote?.trim() || null,
      brandColor,
      rewardImageUrl,
      sortOrder: activeCount,
    },
  });

  setResponseStatus(event, 201);
  return { campaign: serializeCampaign(campaign) };
});
