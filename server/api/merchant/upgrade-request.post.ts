import { Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  message: z.string().trim().max(500).optional().nullable(),
  desiredTier: z.enum(["starter", "growth", "pro"]).optional().nullable(),
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid upgrade request" });
  }

  const pending = await prisma.upgradeRequest.findFirst({
    where: { merchantId: session.merchantId, status: "PENDING" },
  });
  if (pending) {
    throw createError({
      statusCode: 409,
      statusMessage: "You already have a pending upgrade request",
    });
  }

  const request = await prisma.upgradeRequest.create({
    data: {
      merchantId: session.merchantId,
      message: parsed.data.message?.trim() || null,
      desiredTier: parsed.data.desiredTier || null,
    },
  });

  setResponseStatus(event, 201);
  return { request };
});
