import { EventType, Role } from "@prisma/client";
import { z } from "zod";

const schema = z
  .object({
    campaignId: z.string().min(1),
    showCode: z.string().optional(),
    phone: z.string().min(6).max(32).optional(),
    name: z.string().min(1).max(80).optional(),
    amount: z.coerce.number().int().min(1).max(10).default(1),
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
    throw createError({ statusCode: 400, statusMessage: "Invalid stamp request" });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: session.merchantId },
  });
  if (!merchant) {
    throw createError({ statusCode: 404, statusMessage: "Merchant missing" });
  }

  const campaign = await requireCampaign(session.merchantId, parsed.data.campaignId);
  const copy = campaignCopy(campaign.type);

  const usingShowCode = Boolean(parsed.data.showCode?.trim());
  let existing = null as Awaited<ReturnType<typeof findCustomerByShowCode>> | null;

  if (usingShowCode) {
    existing = await findCustomerByShowCode(session.merchantId, parsed.data.showCode!);
  } else {
    const phone = normalizePhone(parsed.data.phone!);
    if (phone.length < 6) {
      throw createError({ statusCode: 400, statusMessage: "Phone looks invalid" });
    }
    existing = await prisma.customer.findUnique({
      where: {
        merchantId_phone: { merchantId: session.merchantId, phone },
      },
    });

    if (!existing && !parsed.data.name?.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: "New customer needs a name",
        data: { code: "NAME_REQUIRED" },
      });
    }
  }

  if (existing) {
    const cutoff = new Date(Date.now() - STAMP_COOLDOWN_SEC * 1000);
    const recent = await prisma.stampEvent.findFirst({
      where: {
        customerId: existing.id,
        campaignId: campaign.id,
        type: EventType.EARN,
        amount: { gt: 0 },
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      const wait = Math.ceil(
        (recent.createdAt.getTime() + STAMP_COOLDOWN_SEC * 1000 - Date.now()) / 1000,
      );
      throw createError({
        statusCode: 429,
        statusMessage: `Cooldown — wait ${Math.max(1, wait)}s before adding again`,
        data: { code: "COOLDOWN", waitSec: Math.max(1, wait) },
      });
    }
  }

  const doubleOn = isDoubleStampActive(campaign.doubleOn);
  let amount = parsed.data.amount;
  if (doubleOn) amount *= 2;

  const now = new Date();
  const md = todayMd(now);
  const { features: shopFeatures } = await getMerchantFeatures(session.merchantId);
  const birthdayBonus =
    hasFeature(shopFeatures, "birthdayBonus") &&
    existing?.birthdayMd === md &&
    existing.birthdayBonusYear !== now.getFullYear();
  if (birthdayBonus) amount += 1;

  const noteParts: string[] = [];
  if (usingShowCode) noteParts.push("Verified show code");
  if (doubleOn) noteParts.push("Double day");
  if (birthdayBonus) noteParts.push("Birthday bonus");
  if (staff) noteParts.push(staff.name);

  const result = await prisma.$transaction(async (tx) => {
    let customer = existing;
    if (!customer) {
      const phone = normalizePhone(parsed.data.phone!);
      customer = await tx.customer.create({
        data: {
          merchantId: session.merchantId!,
          phone,
          name: parsed.data.name!.trim(),
          cardCode: generateCardCode(),
        },
      });
    }

    if (birthdayBonus) {
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          birthdayBonusYear: now.getFullYear(),
          ...(usingShowCode ? { showCode: null, showCodeExpiresAt: null } : {}),
        },
      });
    } else if (usingShowCode) {
      await tx.customer.update({
        where: { id: customer.id },
        data: { showCode: null, showCodeExpiresAt: null },
      });
    }

    const enrollment = await tx.customerCampaign.upsert({
      where: {
        customerId_campaignId: { customerId: customer.id, campaignId: campaign.id },
      },
      update: {
        progress: { increment: amount },
        totalEarned: { increment: amount },
      },
      create: {
        customerId: customer.id,
        campaignId: campaign.id,
        progress: amount,
        totalEarned: amount,
      },
    });

    await tx.stampEvent.create({
      data: {
        customerId: customer.id,
        campaignId: campaign.id,
        type: EventType.EARN,
        amount,
        createdById: session.id,
        staffId: staff?.id,
        note: noteParts.length ? noteParts.join(" · ") : null,
      },
    });

    return { customer, enrollment };
  });

  const canRedeem = result.enrollment.progress >= campaign.goal;
  const almostThere = result.enrollment.progress === campaign.goal - 1;

  if (almostThere) {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentlyReminded =
      result.customer.lastRemindedAt && result.customer.lastRemindedAt.getTime() > dayAgo;
    if (!recentlyReminded) {
      const requestURL = getRequestURL(event);
      const cardUrl = `${requestURL.origin}/m/${merchant.slug}`;
      const wa = await maybeSendAlmostThereWhatsApp({
        phone: result.customer.phone,
        customerName: result.customer.name,
        shopName: `${merchant.name} · ${campaign.name}`,
        stamps: result.enrollment.progress,
        stampGoal: campaign.goal,
        rewardLabel: campaign.rewardLabel,
        cardUrl,
      });
      if (wa.sent) {
        await prisma.customer.update({
          where: { id: result.customer.id },
          data: { lastRemindedAt: new Date() },
        });
      }
    }
  }

  return {
    customer: {
      id: result.customer.id,
      name: result.customer.name,
      phone: result.customer.phone,
      stamps: result.enrollment.progress,
      progress: result.enrollment.progress,
    },
    enrollment: serializeEnrollment(result.enrollment, campaign),
    campaign: serializeCampaign(campaign),
    canRedeem,
    stampGoal: campaign.goal,
    rewardLabel: campaign.rewardLabel,
    verified: usingShowCode,
    amount,
    doubleStamp: doubleOn,
    birthdayBonus: Boolean(birthdayBonus),
    copy,
    staff: staff ? { id: staff.id, name: staff.name } : null,
  };
});
