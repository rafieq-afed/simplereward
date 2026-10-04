import { CampaignType, Role } from "@prisma/client";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(48).optional(),
  ownerName: z.string().min(2).max(80),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(6).max(72),
  stampGoal: z.coerce.number().int().min(2).max(50).default(10),
  rewardLabel: z.string().min(2).max(80).default("Free item"),
});

export default defineEventHandler(async (event) => {
  await requireSession(event, Role.ADMIN);

  const body = await readBody(event);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid merchant data" });
  }

  const slug = slugify(parsed.data.slug || parsed.data.name);
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Invalid slug" });
  }

  const existingSlug = await prisma.merchant.findUnique({ where: { slug } });
  if (existingSlug) {
    throw createError({ statusCode: 409, statusMessage: "Slug already used" });
  }

  const email = parsed.data.ownerEmail.toLowerCase().trim();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw createError({ statusCode: 409, statusMessage: "Owner email already used" });
  }

  const passwordHash = await hashPassword(parsed.data.ownerPassword);

  const starter = featuresFromTier("starter");
  const merchant = await prisma.merchant.create({
    data: {
      name: parsed.data.name.trim(),
      slug,
      features: starter,
      quotedPrice: priceFor(starter),
      onboardedAt: new Date(),
      users: {
        create: {
          email,
          name: parsed.data.ownerName.trim(),
          passwordHash,
          role: Role.MERCHANT,
        },
      },
      campaigns: {
        create: {
          name: "Stamp card",
          type: CampaignType.STAMP,
          goal: parsed.data.stampGoal,
          rewardLabel: parsed.data.rewardLabel.trim(),
        },
      },
    },
  });

  setResponseStatus(event, 201);
  return { merchant };
});
