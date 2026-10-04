import { Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  features: z.record(z.string(), z.boolean()),
  applyTier: z.enum(["starter", "growth", "pro"]).optional(),
});

export default defineEventHandler(async (event) => {
  await requireSession(event, Role.ADMIN);

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Merchant id required" });

  const existing = await prisma.merchant.findUnique({ where: { id } });
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "Merchant not found" });
  }

  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid features payload" });
  }

  const features = parsed.data.applyTier
    ? featuresFromTier(parsed.data.applyTier)
    : parseFeaturePatch(parsed.data.features);
  const quotedPrice = priceFor(features);

  const merchant = await prisma.merchant.update({
    where: { id },
    data: {
      features,
      quotedPrice,
      ...(hasFeature(features, "joinOtp") ? {} : { requireJoinOtp: false }),
    },
  });

  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
      slug: merchant.slug,
      features: normalizeFeatures(merchant.features),
      quotedPrice: merchant.quotedPrice,
    },
    plan: featuresPayload(features, quotedPrice),
  };
});
