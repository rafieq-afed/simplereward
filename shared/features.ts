export const FEATURE_KEYS = [
  "multiCampaign",
  "campaignTypes",
  "brandKit",
  "socialLinks",
  "staffPin",
  "qrScan",
  "undoStamp",
  "doubleDay",
  "csvExport",
  "whatsappBlast",
  "joinOtp",
  "birthdayBonus",
  "walletPass",
  "posters",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureMap = Partial<Record<FeatureKey, boolean>>;

export type FeatureDef = {
  key: FeatureKey;
  label: string;
  blurb: string;
  price: number;
};

export const FEATURE_CATALOG: FeatureDef[] = [
  {
    key: "multiCampaign",
    label: "Multi-campaign",
    blurb: "Up to 5 active promos",
    price: 15,
  },
  {
    key: "campaignTypes",
    label: "B1F1 + Bundle",
    blurb: "Campaign types beyond stamp",
    price: 10,
  },
  {
    key: "brandKit",
    label: "Full brand kit",
    blurb: "Themes, fonts, logo upload",
    price: 12,
  },
  {
    key: "socialLinks",
    label: "Social links",
    blurb: "IG, FB, TikTok, WhatsApp",
    price: 5,
  },
  {
    key: "staffPin",
    label: "Staff PINs",
    blurb: "Counter unlock with PIN",
    price: 8,
  },
  {
    key: "qrScan",
    label: "Camera QR scan",
    blurb: "Scan customer show-code",
    price: 6,
  },
  {
    key: "undoStamp",
    label: "Undo last stamp",
    blurb: "Undo within 15 minutes",
    price: 5,
  },
  {
    key: "doubleDay",
    label: "Double-day promo",
    blurb: "Toggle double progress",
    price: 5,
  },
  {
    key: "csvExport",
    label: "CSV export",
    blurb: "Download customer list",
    price: 8,
  },
  {
    key: "whatsappBlast",
    label: "WhatsApp blast",
    blurb: "Message inactive customers",
    price: 15,
  },
  {
    key: "joinOtp",
    label: "Join OTP",
    blurb: "OTP verification on join",
    price: 5,
  },
  {
    key: "birthdayBonus",
    label: "Birthday bonus",
    blurb: "Free stamp on birthday",
    price: 5,
  },
  {
    key: "walletPass",
    label: "Wallet-lite pass",
    blurb: "Add-to-home style pass",
    price: 5,
  },
  {
    key: "posters",
    label: "A5 / A6 posters",
    blurb: "Print join posters",
    price: 4,
  },
];

export type TierId = "starter" | "growth" | "pro";

export type TierTemplate = {
  id: TierId;
  label: string;
  blurb: string;
  features: FeatureKey[];
};

export const TIER_TEMPLATES: TierTemplate[] = [
  {
    id: "starter",
    label: "Starter",
    blurb: "Brand basics + posters",
    features: ["brandKit", "posters"],
  },
  {
    id: "growth",
    label: "Growth",
    blurb: "Multi-promo counter toolkit",
    features: [
      "brandKit",
      "posters",
      "multiCampaign",
      "campaignTypes",
      "staffPin",
      "qrScan",
      "undoStamp",
      "socialLinks",
    ],
  },
  {
    id: "pro",
    label: "Pro",
    blurb: "Everything unlocked",
    features: [...FEATURE_KEYS],
  },
];

export function emptyFeatures(): Record<FeatureKey, boolean> {
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, false])) as Record<
    FeatureKey,
    boolean
  >;
}

export function normalizeFeatures(raw: unknown): Record<FeatureKey, boolean> {
  const base = emptyFeatures();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const key of FEATURE_KEYS) {
    if (obj[key] === true) base[key] = true;
  }
  return base;
}

export function featuresFromTier(tier: TierId): Record<FeatureKey, boolean> {
  const tpl = TIER_TEMPLATES.find((t) => t.id === tier);
  const base = emptyFeatures();
  for (const key of tpl?.features || []) base[key] = true;
  return base;
}

export function hasFeature(
  features: FeatureMap | null | undefined,
  key: FeatureKey,
) {
  return Boolean(features?.[key]);
}

export function enabledFeatureCount(features: FeatureMap | null | undefined) {
  return FEATURE_KEYS.filter((k) => features?.[k]).length;
}

export function priceFor(features: FeatureMap | null | undefined) {
  return FEATURE_CATALOG.reduce(
    (sum, f) => sum + (features?.[f.key] ? f.price : 0),
    0,
  );
}

export function tierSuggestedPrice(tier: TierId) {
  return priceFor(featuresFromTier(tier));
}

export function featureLimits(features: FeatureMap | null | undefined) {
  return {
    maxActiveCampaigns: hasFeature(features, "multiCampaign") ? 5 : 1,
    maxStaff: hasFeature(features, "staffPin") ? 20 : 0,
  };
}

export function parseFeaturePatch(raw: unknown): Record<FeatureKey, boolean> {
  const base = emptyFeatures();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const key of FEATURE_KEYS) {
    base[key] = obj[key] === true;
  }
  return base;
}
