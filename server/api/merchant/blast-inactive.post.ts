import { Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(14),
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  await requireFeature(event, session.merchantId, "whatsappBlast");

  const parsed = schema.safeParse(await readBody(event).catch(() => ({})));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid blast request" });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: session.merchantId },
  });
  if (!merchant) {
    throw createError({ statusCode: 404, statusMessage: "Merchant missing" });
  }

  const cutoff = new Date(Date.now() - parsed.data.days * 24 * 60 * 60 * 1000);
  const blastCooldown = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const inactive = await prisma.customer.findMany({
    where: {
      merchantId: merchant.id,
      updatedAt: { lt: cutoff },
      OR: [{ lastBlastAt: null }, { lastBlastAt: { lt: blastCooldown } }],
    },
    take: 50,
    orderBy: { updatedAt: "asc" },
  });

  const requestURL = getRequestURL(event);
  const cardUrl = `${requestURL.origin}/m/${merchant.slug}`;

  let sent = 0;
  let skipped = 0;

  for (const c of inactive) {
    const result = await maybeSendInactiveBlast({
      phone: c.phone,
      customerName: c.name,
      shopName: merchant.name,
      cardUrl,
      rewardLabel: merchant.rewardLabel,
    });

    if (result.sent || result.reason === "not_configured") {
      // Always mark when not_configured so demos don't spam console on every click;
      // when configured, only mark successful sends.
      if (result.sent || result.reason === "not_configured") {
        await prisma.customer.update({
          where: { id: c.id },
          data: { lastBlastAt: new Date() },
        });
        if (result.sent) sent += 1;
        else skipped += 1;
      }
    } else {
      skipped += 1;
    }
  }

  return {
    matched: inactive.length,
    sent,
    skipped,
    configured: whatsappConfigured(),
    message: whatsappConfigured()
      ? `Sent ${sent} of ${inactive.length} inactive customers.`
      : `Found ${inactive.length} inactive — WhatsApp not configured (logged in dev).`,
  };
});
