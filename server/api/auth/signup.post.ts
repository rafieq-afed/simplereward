import { CampaignType, Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  shopName: z.string().trim().min(2).max(80),
  ownerName: z.string().trim().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

async function uniqueSlug(base: string) {
  let slug = slugify(base);
  if (!slug) slug = "shop";

  for (let i = 0; i < 12; i++) {
    const candidate = i === 0 ? slug : `${slug.slice(0, 40)}-${i + 1}`;
    const taken = await prisma.merchant.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  return `${slug.slice(0, 36)}-${Date.now().toString(36)}`;
}

export default defineEventHandler(async (event) => {
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Check shop name, your name, email, and password (min 6).",
    });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw createError({ statusCode: 409, statusMessage: "Email already registered — log in instead" });
  }

  const slug = await uniqueSlug(parsed.data.shopName);
  const passwordHash = await hashPassword(parsed.data.password);

  const starter = featuresFromTier("starter");
  const merchant = await prisma.merchant.create({
    data: {
      name: parsed.data.shopName,
      slug,
      welcomeNote: "Collect rewards. Treat on us.",
      brandColor: "#1f7a57",
      features: starter,
      quotedPrice: priceFor(starter),
      onboardedAt: null,
      users: {
        create: {
          email,
          name: parsed.data.ownerName,
          passwordHash,
          role: Role.MERCHANT,
        },
      },
      campaigns: {
        create: {
          name: "Stamp card",
          type: CampaignType.STAMP,
          goal: 10,
          rewardLabel: "Free item",
          sortOrder: 0,
        },
      },
    },
    include: { users: true },
  });

  const user = merchant.users[0];
  await createSession(event, {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    merchantId: merchant.id,
  });

  setResponseStatus(event, 201);
  return {
    merchant: { id: merchant.id, name: merchant.name, slug: merchant.slug },
    redirectTo: "/merchant/onboarding",
  };
});
