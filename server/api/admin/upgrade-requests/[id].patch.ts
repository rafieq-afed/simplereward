import { Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["DONE", "REJECTED"]),
  applyTier: z.enum(["starter", "growth", "pro"]).optional(),
});

export default defineEventHandler(async (event) => {
  await requireSession(event, Role.ADMIN);

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Request id required" });

  const existing = await prisma.upgradeRequest.findUnique({
    where: { id },
    include: { merchant: true },
  });
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "Request not found" });
  }

  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid update" });
  }

  if (parsed.data.status === "DONE" && parsed.data.applyTier) {
    const features = featuresFromTier(parsed.data.applyTier);
    const quotedPrice = priceFor(features);
    await prisma.merchant.update({
      where: { id: existing.merchantId },
      data: {
        features,
        quotedPrice,
        ...(hasFeature(features, "joinOtp") ? {} : { requireJoinOtp: false }),
      },
    });
  }

  const request = await prisma.upgradeRequest.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return { request };
});
