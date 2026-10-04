import { Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  campaignId: z.string().min(1),
  doubleStamp: z.boolean(),
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid promo toggle" });
  }

  await requireFeature(event, session.merchantId, "doubleDay");
  await requireCampaign(session.merchantId, parsed.data.campaignId);

  const campaign = await prisma.campaign.update({
    where: { id: parsed.data.campaignId },
    data: {
      doubleOn: parsed.data.doubleStamp ? new Date() : null,
    },
  });

  return {
    doubleStamp: isDoubleStampActive(campaign.doubleOn),
    campaign: serializeCampaign(campaign),
  };
});
