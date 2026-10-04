import { EventType, Role } from "@prisma/client";

const UNDO_WINDOW_MS = 15 * 60 * 1000;

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  await requireFeature(event, session.merchantId, "undoStamp");
  await requireStaffIfConfigured(event, session.merchantId);
  const query = getQuery(event);
  const campaignId = String(query.campaignId || "");
  const cutoff = new Date(Date.now() - UNDO_WINDOW_MS);

  const last = await prisma.stampEvent.findFirst({
    where: {
      type: EventType.EARN,
      createdAt: { gte: cutoff },
      customer: { merchantId: session.merchantId },
      ...(campaignId ? { campaignId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      campaign: true,
    },
  });

  if (!last || !last.campaignId) {
    throw createError({
      statusCode: 404,
      statusMessage: "Nothing to undo — only progress from the last 15 minutes",
    });
  }

  const later = await prisma.stampEvent.findFirst({
    where: {
      customerId: last.customerId,
      campaignId: last.campaignId,
      createdAt: { gt: last.createdAt },
    },
    select: { id: true, type: true },
  });
  if (later) {
    throw createError({
      statusCode: 400,
      statusMessage:
        later.type === EventType.REDEEM
          ? "Can't undo — already redeemed after this"
          : "Can't undo — newer progress exists",
    });
  }

  const enrollment = await prisma.customerCampaign.findUnique({
    where: {
      customerId_campaignId: {
        customerId: last.customerId,
        campaignId: last.campaignId,
      },
    },
  });

  if (!enrollment || enrollment.progress < last.amount) {
    throw createError({
      statusCode: 400,
      statusMessage: "Can't undo — progress no longer matches",
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.customerCampaign.update({
      where: { id: enrollment.id },
      data: {
        progress: { decrement: last.amount },
        totalEarned: { decrement: Math.min(last.amount, enrollment.totalEarned) },
      },
    });
    await tx.stampEvent.delete({ where: { id: last.id } });
    return next;
  });

  return {
    undone: { amount: last.amount, at: last.createdAt, campaignId: last.campaignId },
    customer: {
      id: last.customer.id,
      name: last.customer.name,
      phone: last.customer.phone,
      stamps: updated.progress,
      progress: updated.progress,
    },
    campaign: last.campaign ? serializeCampaign(last.campaign) : null,
  };
});
