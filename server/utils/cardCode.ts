import { randomInt } from "node:crypto";

const CARD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCardCode(length = 6) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CARD_ALPHABET[randomInt(CARD_ALPHABET.length)];
  }
  return out;
}

export async function ensureCardCode(customerId: string, merchantId: string) {
  const row = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "Customer not found" });
  }
  if (row.cardCode) return row;

  for (let attempt = 0; attempt < 12; attempt++) {
    const cardCode = generateCardCode();
    const taken = await prisma.customer.findFirst({
      where: { merchantId, cardCode },
      select: { id: true },
    });
    if (taken) continue;

    return prisma.customer.update({
      where: { id: customerId },
      data: { cardCode },
    });
  }

  throw createError({ statusCode: 500, statusMessage: "Could not assign card code" });
}

/** Fresh 4-digit code the buyer shows at the counter (expires quickly). */
export async function issueShowCode(customerId: string, merchantId: string) {
  await ensureCardCode(customerId, merchantId);
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

  for (let attempt = 0; attempt < 16; attempt++) {
    const showCode = String(randomInt(1000, 10000));
    const clash = await prisma.customer.findFirst({
      where: {
        merchantId,
        showCode,
        showCodeExpiresAt: { gt: new Date() },
        NOT: { id: customerId },
      },
      select: { id: true },
    });
    if (clash) continue;

    return prisma.customer.update({
      where: { id: customerId },
      data: { showCode, showCodeExpiresAt: expiresAt },
    });
  }

  throw createError({ statusCode: 500, statusMessage: "Could not issue show code" });
}

export async function findCustomerByShowCode(merchantId: string, rawCode: string) {
  const showCode = String(rawCode || "")
    .replace(/\D/g, "")
    .slice(0, 4);
  if (showCode.length !== 4) {
    throw createError({ statusCode: 400, statusMessage: "Enter the 4-digit show code" });
  }

  const customer = await prisma.customer.findFirst({
    where: {
      merchantId,
      showCode,
      showCodeExpiresAt: { gt: new Date() },
    },
  });

  if (!customer) {
    throw createError({
      statusCode: 404,
      statusMessage: "Show code invalid or expired — ask buyer to refresh their card",
    });
  }

  return customer;
}
