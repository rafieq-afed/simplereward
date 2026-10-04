import { CampaignType, Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  type: z.enum(["STAMP", "B1F1", "BUNDLE"]).optional(),
  goal: z.coerce.number().int().min(1).max(50).optional(),
  rewardLabel: z.string().trim().min(2).max(80).optional(),
  welcomeNote: z.string().trim().max(255).optional().nullable(),
  brandColor: z.string().max(7).optional().nullable(),
  rewardImageUrl: z.string().max(500).optional().nullable(),
  active: z.boolean().optional(),
  doubleOn: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Campaign id required" });

  const existing = await prisma.campaign.findFirst({
    where: { id, merchantId: session.merchantId },
  });
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "Campaign not found" });
  }

  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid campaign update" });
  }

  const { features, limits } = await getMerchantFeatures(session.merchantId);

  const nextType = parsed.data.type || existing.type;
  const nextGoal = parsed.data.goal ?? existing.goal;
  if (nextType === "STAMP" && nextGoal < 2) {
    throw createError({ statusCode: 400, statusMessage: "Stamp cards need at least 2" });
  }
  if (
    parsed.data.type &&
    parsed.data.type !== "STAMP" &&
    !hasFeature(features, "campaignTypes")
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: "Upgrade required: B1F1 + Bundle",
    });
  }
  if (parsed.data.rewardImageUrl?.trim() && !hasFeature(features, "brandKit")) {
    await requireFeature(event, session.merchantId, "brandKit");
  }
  if (parsed.data.doubleOn !== undefined) {
    await requireFeature(event, session.merchantId, "doubleDay");
  }

  if (parsed.data.active === true && !existing.active) {
    const activeCount = await prisma.campaign.count({
      where: { merchantId: session.merchantId, active: true },
    });
    if (activeCount >= limits.maxActiveCampaigns) {
      throw createError({
        statusCode: 400,
        statusMessage: `Max ${limits.maxActiveCampaigns} active campaign${limits.maxActiveCampaigns === 1 ? "" : "s"} on your plan`,
      });
    }
  }

  if (parsed.data.active === false) {
    const activeCount = await prisma.campaign.count({
      where: { merchantId: session.merchantId, active: true },
    });
    if (activeCount <= 1) {
      throw createError({
        statusCode: 400,
        statusMessage: "Keep at least one active campaign",
      });
    }
  }

  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.type ? { type: parsed.data.type as CampaignType } : {}),
      ...(parsed.data.goal != null ? { goal: parsed.data.goal } : {}),
      ...(parsed.data.rewardLabel ? { rewardLabel: parsed.data.rewardLabel } : {}),
      ...(parsed.data.welcomeNote !== undefined
        ? { welcomeNote: parsed.data.welcomeNote?.trim() || null }
        : {}),
      ...(parsed.data.brandColor !== undefined
        ? { brandColor: normalizeBrandColor(parsed.data.brandColor) }
        : {}),
      ...(parsed.data.rewardImageUrl !== undefined
        ? {
            rewardImageUrl: (() => {
              const raw = parsed.data.rewardImageUrl?.trim() || null;
              if (!raw) return null;
              if (raw.startsWith("/uploads/")) return raw.slice(0, 500);
              return normalizeLogoUrl(raw);
            })(),
          }
        : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.doubleOn !== undefined
        ? { doubleOn: parsed.data.doubleOn ? new Date() : null }
        : {}),
    },
  });

  return { campaign: serializeCampaign(campaign) };
});
