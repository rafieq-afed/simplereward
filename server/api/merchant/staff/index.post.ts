import { Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4–6 digits"),
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Name and 4–6 digit PIN required" });
  }

  const { limits } = await getMerchantFeatures(session.merchantId);
  if (limits.maxStaff < 1) {
    await requireFeature(event, session.merchantId, "staffPin");
  }

  const count = await prisma.staff.count({
    where: { merchantId: session.merchantId, active: true },
  });
  if (count >= limits.maxStaff) {
    throw createError({
      statusCode: 400,
      statusMessage: `Staff limit reached (${limits.maxStaff})`,
    });
  }

  const pinHash = await hashStaffPin(parsed.data.pin);
  const staff = await prisma.staff.create({
    data: {
      merchantId: session.merchantId,
      name: parsed.data.name,
      pinHash,
    },
    select: { id: true, name: true, createdAt: true },
  });

  return { staff };
});
