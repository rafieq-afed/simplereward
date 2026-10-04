import { randomInt } from "node:crypto";
import { z } from "zod";

const schema = z.object({
  phone: z.string().min(6).max(32),
  name: z.string().min(1).max(80),
});

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 404, statusMessage: "Shop not found" });
  }

  const merchant = await prisma.merchant.findUnique({ where: { slug } });
  if (!merchant) {
    throw createError({ statusCode: 404, statusMessage: "Shop not found" });
  }

  const features = normalizeFeatures(merchant.features);
  if (!merchant.requireJoinOtp || !hasFeature(features, "joinOtp")) {
    return { required: false };
  }

  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Name and phone required" });
  }

  const phone = normalizePhone(parsed.data.phone);
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.otpChallenge.upsert({
    where: {
      merchantId_phone: { merchantId: merchant.id, phone },
    },
    update: {
      name: parsed.data.name.trim(),
      code,
      expiresAt,
    },
    create: {
      merchantId: merchant.id,
      phone,
      name: parsed.data.name.trim(),
      code,
      expiresAt,
    },
  });

  const wa = await maybeSendOtpWhatsApp(phone, merchant.name, code);

  return {
    required: true,
    expiresIn: 600,
    /** Only returned when WhatsApp is not configured — for local/demo. */
    devOtp: wa.reason === "not_configured" ? code : undefined,
    sent: wa.sent,
  };
});
