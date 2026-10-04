import { CampaignType, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  featuresFromTier,
  priceFor,
  type TierId,
} from "../shared/features";

const prisma = new PrismaClient();

type SeedCampaign = {
  name: string;
  type: CampaignType;
  goal: number;
  rewardLabel: string;
  welcomeNote?: string;
  brandColor?: string;
};

const cafes: {
  name: string;
  slug: string;
  email: string;
  ownerName: string;
  brandColor: string;
  welcomeNote: string;
  tier: TierId;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  whatsappUrl?: string | null;
  campaigns: SeedCampaign[];
}[] = [
  {
    name: "Cookie Cafe",
    slug: "cookie-cafe",
    email: "merchant@cookie.cafe",
    ownerName: "Cookie Cafe Owner",
    brandColor: "#1f7a57",
    welcomeNote: "Two promos running — stamps + B1F1 dessert.",
    tier: "pro",
    instagramUrl: "https://instagram.com/cookiecafe",
    facebookUrl: null,
    tiktokUrl: null,
    whatsappUrl: "https://wa.me/60123456789",
    campaigns: [
      {
        name: "Coffee stamps",
        type: CampaignType.STAMP,
        goal: 8,
        rewardLabel: "Free cookie or coffee",
        brandColor: "#1f7a57",
      },
      {
        name: "Dessert B1F1",
        type: CampaignType.B1F1,
        goal: 1,
        rewardLabel: "Free dessert",
        brandColor: "#b45309",
      },
    ],
  },
  {
    name: "Bean & Brew",
    slug: "bean-and-brew",
    email: "merchant@beanbrew.cafe",
    ownerName: "Bean & Brew Owner",
    brandColor: "#6b3f2a",
    welcomeNote: "Buy a drink, claim one free.",
    tier: "growth",
    campaigns: [
      {
        name: "Latte B1F1",
        type: CampaignType.B1F1,
        goal: 1,
        rewardLabel: "Free latte",
        brandColor: "#6b3f2a",
      },
    ],
  },
  {
    name: "Kopi Corner",
    slug: "kopi-corner",
    email: "merchant@kopicorn.cafe",
    ownerName: "Kopi Corner Owner",
    brandColor: "#b45309",
    welcomeNote: "Starter package — stamp card only.",
    tier: "starter",
    campaigns: [
      {
        name: "Teh stamp",
        type: CampaignType.STAMP,
        goal: 6,
        rewardLabel: "Free teh tarik",
        brandColor: "#0f766e",
      },
    ],
  },
];

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name: "Platform Admin", role: Role.ADMIN },
    create: {
      email,
      passwordHash,
      name: "Platform Admin",
      role: Role.ADMIN,
    },
  });

  const merchantHash = await bcrypt.hash("merchant123", 10);

  for (const cafe of cafes) {
    const features = featuresFromTier(cafe.tier);
    const quotedPrice = priceFor(features);

    const merchant = await prisma.merchant.upsert({
      where: { slug: cafe.slug },
      update: {
        name: cafe.name,
        welcomeNote: cafe.welcomeNote,
        brandColor: cafe.brandColor,
        instagramUrl: cafe.instagramUrl ?? null,
        facebookUrl: cafe.facebookUrl ?? null,
        tiktokUrl: cafe.tiktokUrl ?? null,
        whatsappUrl: cafe.whatsappUrl ?? null,
        features,
        quotedPrice,
        onboardedAt: new Date(),
        requireJoinOtp: hasFeatureJoinOtp(features),
      },
      create: {
        name: cafe.name,
        slug: cafe.slug,
        welcomeNote: cafe.welcomeNote,
        brandColor: cafe.brandColor,
        instagramUrl: cafe.instagramUrl ?? null,
        facebookUrl: cafe.facebookUrl ?? null,
        tiktokUrl: cafe.tiktokUrl ?? null,
        whatsappUrl: cafe.whatsappUrl ?? null,
        features,
        quotedPrice,
        onboardedAt: new Date(),
        requireJoinOtp: hasFeatureJoinOtp(features),
      },
    });

    await prisma.user.upsert({
      where: { email: cafe.email },
      update: {
        passwordHash: merchantHash,
        name: cafe.ownerName,
        role: Role.MERCHANT,
        merchantId: merchant.id,
      },
      create: {
        email: cafe.email,
        passwordHash: merchantHash,
        name: cafe.ownerName,
        role: Role.MERCHANT,
        merchantId: merchant.id,
      },
    });

    await prisma.campaign.deleteMany({ where: { merchantId: merchant.id } });
    let order = 0;
    for (const c of cafe.campaigns) {
      await prisma.campaign.create({
        data: {
          merchantId: merchant.id,
          name: c.name,
          type: c.type,
          goal: c.goal,
          rewardLabel: c.rewardLabel,
          welcomeNote: c.welcomeNote,
          brandColor: c.brandColor || cafe.brandColor,
          sortOrder: order++,
          active: true,
        },
      });
      console.log(`  Campaign: ${c.name} [${c.type}]`);
    }

    if (cafe.slug === "cookie-cafe") {
      const demoStaff = [
        { name: "Aina", pin: "1234" },
        { name: "Rafi", pin: "5678" },
      ];
      for (const s of demoStaff) {
        const existing = await prisma.staff.findFirst({
          where: { merchantId: merchant.id, name: s.name },
        });
        const pinHash = await bcrypt.hash(s.pin, 10);
        if (existing) {
          await prisma.staff.update({
            where: { id: existing.id },
            data: { pinHash, active: true },
          });
        } else {
          await prisma.staff.create({
            data: { merchantId: merchant.id, name: s.name, pinHash },
          });
        }
        console.log(`  Staff ${s.name} PIN ${s.pin}`);
      }
    }

    console.log(
      `Seeded ${cafe.name} [${cafe.tier} RM${quotedPrice}]: ${cafe.email} → /m/${cafe.slug}`,
    );
  }

  console.log("Seeded admin:", email);
}

function hasFeatureJoinOtp(features: Record<string, boolean>) {
  return Boolean(features.joinOtp);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
