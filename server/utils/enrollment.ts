import type { Campaign, Customer, CustomerCampaign } from "@prisma/client";

export async function getActiveCampaigns(merchantId: string) {
  return prisma.campaign.findMany({
    where: { merchantId, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function requireCampaign(merchantId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, merchantId, active: true },
  });
  if (!campaign) {
    throw createError({ statusCode: 404, statusMessage: "Campaign not found" });
  }
  return campaign;
}

export async function ensureEnrollment(customerId: string, campaignId: string) {
  return prisma.customerCampaign.upsert({
    where: {
      customerId_campaignId: { customerId, campaignId },
    },
    update: {},
    create: { customerId, campaignId },
  });
}

export function serializeCampaign(campaign: Campaign) {
  return {
    id: campaign.id,
    name: campaign.name,
    type: campaign.type,
    goal: campaign.goal,
    rewardLabel: campaign.rewardLabel,
    welcomeNote: campaign.welcomeNote,
    brandColor: campaign.brandColor,
    rewardImageUrl: campaign.rewardImageUrl,
    active: campaign.active,
    sortOrder: campaign.sortOrder,
    doubleOn: campaign.doubleOn,
    doubleActive: isDoubleStampActive(campaign.doubleOn),
    campaign: campaignCopy(campaign.type),
  };
}

export function serializeEnrollment(
  enrollment: CustomerCampaign,
  campaign: Campaign,
  customer?: Pick<Customer, "name" | "phone" | "cardCode" | "birthdayMd">,
) {
  return {
    id: enrollment.id,
    progress: enrollment.progress,
    stamps: enrollment.progress,
    totalEarned: enrollment.totalEarned,
    totalRedeemed: enrollment.totalRedeemed,
    campaign: serializeCampaign(campaign),
    ...(customer
      ? {
          name: customer.name,
          phone: customer.phone,
          cardCode: customer.cardCode,
          birthdayMd: customer.birthdayMd,
        }
      : {}),
  };
}
