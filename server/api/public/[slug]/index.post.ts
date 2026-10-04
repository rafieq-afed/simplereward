import { z } from "zod";

const joinSchema = z.object({
  phone: z.string().min(6).max(32),
  name: z.string().min(1).max(80),
  otp: z.string().optional(),
  birthdayMd: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 404, statusMessage: "Shop not found" });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { slug },
    include: {
      campaigns: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!merchant) {
    throw createError({ statusCode: 404, statusMessage: "Shop not found" });
  }

  const body = await readBody(event);
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Name and phone required" });
  }

  const phone = normalizePhone(parsed.data.phone);
  const birthdayMd = parsed.data.birthdayMd
    ? parseBirthdayMd(parsed.data.birthdayMd)
    : null;

  const features = normalizeFeatures(merchant.features);
  if (merchant.requireJoinOtp && hasFeature(features, "joinOtp")) {
    const otp = String(parsed.data.otp || "").replace(/\D/g, "");
    if (otp.length !== 6) {
      throw createError({
        statusCode: 400,
        statusMessage: "Enter the 6-digit code we sent",
        data: { code: "OTP_REQUIRED" },
      });
    }

    const challenge = await prisma.otpChallenge.findUnique({
      where: { merchantId_phone: { merchantId: merchant.id, phone } },
    });

    if (!challenge || challenge.expiresAt < new Date() || challenge.code !== otp) {
      throw createError({
        statusCode: 401,
        statusMessage: "Code invalid or expired — request a new one",
        data: { code: "OTP_INVALID" },
      });
    }

    await prisma.otpChallenge.delete({ where: { id: challenge.id } });
  }

  let customer = await prisma.customer.upsert({
    where: {
      merchantId_phone: {
        merchantId: merchant.id,
        phone,
      },
    },
    update: {
      name: parsed.data.name.trim(),
      ...(birthdayMd ? { birthdayMd } : {}),
    },
    create: {
      merchantId: merchant.id,
      phone,
      name: parsed.data.name.trim(),
      cardCode: generateCardCode(),
      ...(birthdayMd ? { birthdayMd } : {}),
    },
  });

  for (const camp of merchant.campaigns) {
    await ensureEnrollment(customer.id, camp.id);
  }

  customer = await issueShowCode(customer.id, merchant.id);
  const expiresInSec = customer.showCodeExpiresAt
    ? Math.max(0, Math.round((customer.showCodeExpiresAt.getTime() - Date.now()) / 1000))
    : 0;

  const enrollments = await prisma.customerCampaign.findMany({
    where: { customerId: customer.id, campaign: { active: true } },
    include: { campaign: true },
    orderBy: { campaign: { sortOrder: "asc" } },
  });
  const primary = enrollments[0];

  return {
    customer: {
      name: customer.name,
      phone: customer.phone,
      stamps: primary?.progress ?? 0,
      progress: primary?.progress ?? 0,
      totalRedeemed: primary?.totalRedeemed ?? 0,
      cardCode: customer.cardCode,
      showCode: customer.showCode,
      showCodeExpiresIn: expiresInSec,
      birthdayMd: customer.birthdayMd,
    },
    enrollments: enrollments.map((e) => serializeEnrollment(e, e.campaign)),
    campaigns: merchant.campaigns.map(serializeCampaign),
    merchant: {
      name: merchant.name,
      stampGoal: primary?.campaign.goal ?? 10,
      rewardLabel: primary?.campaign.rewardLabel ?? "Free item",
    },
  };
});
