import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid credentials" });
  }

  const session = await loginWithCredentials(
    event,
    parsed.data.email.toLowerCase().trim(),
    parsed.data.password,
  );

  if (!session) {
    throw createError({ statusCode: 401, statusMessage: "Email or password is wrong" });
  }

  let redirectTo = session.role === "ADMIN" ? "/admin" : "/merchant";
  if (session.role === "MERCHANT" && session.merchantId) {
    const merchant = await prisma.merchant.findUnique({
      where: { id: session.merchantId },
      select: { onboardedAt: true },
    });
    if (merchant && !merchant.onboardedAt) {
      redirectTo = "/merchant/onboarding";
    }
  }

  return {
    user: session,
    redirectTo,
  };
});

