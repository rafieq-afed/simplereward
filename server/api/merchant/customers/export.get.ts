import { Role } from "@prisma/client";

function csvEscape(value: string | number | null | undefined) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  await requireFeature(event, session.merchantId, "csvExport");

  const merchant = await prisma.merchant.findUnique({
    where: { id: session.merchantId },
    select: { slug: true },
  });

  const rowsDb = await prisma.customerCampaign.findMany({
    where: { campaign: { merchantId: session.merchantId } },
    include: {
      customer: true,
      campaign: true,
    },
    orderBy: [{ customer: { name: "asc" } }, { campaign: { sortOrder: "asc" } }],
  });

  const header = [
    "name",
    "phone",
    "campaign",
    "campaignType",
    "progress",
    "goal",
    "totalEarned",
    "totalRedeemed",
    "birthday",
    "cardCode",
    "updatedAt",
  ];

  const rows = rowsDb.map((e) =>
    [
      e.customer.name,
      e.customer.phone,
      e.campaign.name,
      e.campaign.type,
      e.progress,
      e.campaign.goal,
      e.totalEarned,
      e.totalRedeemed,
      e.customer.birthdayMd || "",
      e.customer.cardCode || "",
      e.updatedAt.toISOString(),
    ]
      .map(csvEscape)
      .join(","),
  );

  const body = [header.join(","), ...rows].join("\n");
  const filename = `customers-${merchant?.slug || "shop"}.csv`;

  setHeader(event, "Content-Type", "text/csv; charset=utf-8");
  setHeader(event, "Content-Disposition", `attachment; filename="${filename}"`);
  return body;
});
