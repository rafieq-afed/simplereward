import { Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Enter a 4–6 digit PIN" });
  }

  const staffRows = await prisma.staff.findMany({
    where: { merchantId: session.merchantId, active: true },
  });
  if (staffRows.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No staff PINs set up yet" });
  }

  for (const row of staffRows) {
    const ok = await verifyStaffPin(parsed.data.pin, row.pinHash);
    if (!ok) continue;

    await createStaffSession(event, {
      id: row.id,
      name: row.name,
      merchantId: row.merchantId,
    });

    return { staff: { id: row.id, name: row.name } };
  }

  throw createError({ statusCode: 401, statusMessage: "Wrong PIN" });
});
