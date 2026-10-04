import { EventType, Role } from "@prisma/client";

const UNDO_WINDOW_MS = 15 * 60 * 1000;

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const campaignId = String(getQuery(event).campaignId || "");
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

  if (!last || !last.campaignId || !last.campaign) {
    return { undoable: null };
  }

  const later = await prisma.stampEvent.findFirst({
    where: {
      customerId: last.customerId,
      campaignId: last.campaignId,
      createdAt: { gt: last.createdAt },
    },
    select: { id: true },
  });

  const enrollment = await prisma.customerCampaign.findUnique({
    where: {
      customerId_campaignId: {
        customerId: last.customerId,
        campaignId: last.campaignId,
      },
    },
  });

  if (later || !enrollment || enrollment.progress < last.amount) {
    return { undoable: null };
  }

  return {
    undoable: {
      eventId: last.id,
      amount: last.amount,
      createdAt: last.createdAt,
      campaignId: last.campaignId,
      campaignName: last.campaign.name,
      customer: {
        id: last.customer.id,
        name: last.customer.name,
        phone: last.customer.phone,
        stamps: enrollment.progress,
      },
    },
  };
});
