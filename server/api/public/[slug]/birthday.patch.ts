import { z } from "zod";

const schema = z.object({
  phone: z.string().min(6).max(32),
  birthdayMd: z.string().min(3).max(5),
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

  if (!hasFeature(normalizeFeatures(merchant.features), "birthdayBonus")) {
    throw createError({
      statusCode: 403,
      statusMessage: "Birthday bonus is not enabled for this shop",
    });
  }

  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Phone and birthday required" });
  }

  const birthdayMd = parseBirthdayMd(parsed.data.birthdayMd);
  if (!birthdayMd) {
    throw createError({ statusCode: 400, statusMessage: "Use birthday as MM-DD" });
  }

  const phone = normalizePhone(parsed.data.phone);
  const customer = await prisma.customer.findUnique({
    where: { merchantId_phone: { merchantId: merchant.id, phone } },
  });
  if (!customer) {
    throw createError({ statusCode: 404, statusMessage: "Card not found" });
  }

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: { birthdayMd },
  });

  return { birthdayMd: updated.birthdayMd };
});
