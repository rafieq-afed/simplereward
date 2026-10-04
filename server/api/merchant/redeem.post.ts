import { EventType, Role } from "@prisma/client";
import { z } from "zod";

const schema = z
  .object({
    campaignId: z.string().min(1),
    showCode: z.string().optional(),
    phone: z.string().min(6).max(32).optional(),
  })
  .refine((d) => Boolean(d.showCode?.trim() || d.phone?.trim()), {
    message: "Show code or phone required",
  });

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const staff = await requireStaffIfConfigured(event, session.merchantId);
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid redeem request" });
  }

  const campaign = await requireCampaign(session.merchantId, parsed.data.campaignId);
  const usingShowCode = Boolean(parsed.data.showCode?.trim());

  let customer = null as Awaited<ReturnType<typeof findCustomerByShowCode>> | null;
  if (usingShowCode) {
    customer = await findCustomerByShowCode(session.merchantId, parsed.data.showCode!);
  } else {
    const phone = normalizePhone(parsed.data.phone!);
    customer = await prisma.customer.findUnique({
      where: {
        merchantId_phone: { merchantId: session.merchantId, phone },
      },
    });
  }

  if (!customer) {
    throw createError({ statusCode: 404, statusMessage: "Customer not found" });
  }

  const enrollment = await prisma.customerCampaign.findUnique({
    where: {
      customerId_campaignId: { customerId: customer.id, campaignId: campaign.id },
    },
  });

  if (!enrollment || enrollment.progress < campaign.goal) {
    throw createError({
      statusCode: 400,
      statusMessage: `Need ${campaign.goal} ${campaignCopy(campaign.type).unitPlural} to redeem`,
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.customerCampaign.update({
      where: { id: enrollment.id },
      data: {
        progress: { decrement: campaign.goal },
        totalRedeemed: { increment: 1 },
      },
    });

    if (usingShowCode) {
      await tx.customer.update({
        where: { id: customer!.id },
        data: { showCode: null, showCodeExpiresAt: null },
      });
    }

    await tx.stampEvent.create({
      data: {
        customerId: customer!.id,
        campaignId: campaign.id,
        type: EventType.REDEEM,
        amount: campaign.goal,
        note: `${campaign.rewardLabel}${usingShowCode ? " (verified)" : ""}${staff ? ` · ${staff.name}` : ""}`,
        createdById: session.id,
        staffId: staff?.id,
      },
    });

    return next;
  });

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      stamps: updated.progress,
      progress: updated.progress,
    },
    enrollment: serializeEnrollment(updated, campaign),
    campaign: serializeCampaign(campaign),
    rewardLabel: campaign.rewardLabel,
    stampGoal: campaign.goal,
    verified: usingShowCode,
    staff: staff ? { id: staff.id, name: staff.name } : null,
  };
});
