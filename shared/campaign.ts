export type CampaignType = "STAMP" | "B1F1" | "BUNDLE";

export type CampaignCopy = {
  type: CampaignType;
  title: string;
  blurb: string;
  unitSingular: string;
  unitPlural: string;
  progressLabel: string;
  addAction: string;
  redeemAction: string;
  readyLabel: string;
  doubleLabel: string;
  goalLabel: string;
  goalHint: string;
  defaultGoal: number;
  defaultReward: string;
};

const COPY: Record<CampaignType, Omit<CampaignCopy, "type">> = {
  STAMP: {
    title: "Stamp card",
    blurb: "Collect stamps each visit, then redeem a treat.",
    unitSingular: "stamp",
    unitPlural: "stamps",
    progressLabel: "Stamps",
    addAction: "Add stamp",
    redeemAction: "Redeem",
    readyLabel: "Ready to redeem!",
    doubleLabel: "Double stamp today",
    goalLabel: "Stamps needed",
    goalHint: "How many stamps before the reward",
    defaultGoal: 10,
    defaultReward: "Free item",
  },
  B1F1: {
    title: "Buy 1 Free 1",
    blurb: "After paid purchases hit the goal, customer claims a free item.",
    unitSingular: "purchase",
    unitPlural: "purchases",
    progressLabel: "Purchases",
    addAction: "Add purchase",
    redeemAction: "Claim free",
    readyLabel: "Free item ready!",
    doubleLabel: "Double purchase today",
    goalLabel: "Paid purchases needed",
    goalHint: "Classic B1F1 = 1 (buy once, then free)",
    defaultGoal: 1,
    defaultReward: "Free item",
  },
  BUNDLE: {
    title: "Bundle",
    blurb: "Track items toward a set / bundle deal, then complete it.",
    unitSingular: "item",
    unitPlural: "items",
    progressLabel: "Bundle items",
    addAction: "Add item",
    redeemAction: "Complete bundle",
    readyLabel: "Bundle ready!",
    doubleLabel: "Double items today",
    goalLabel: "Items in bundle",
    goalHint: "e.g. 3 for a set menu",
    defaultGoal: 3,
    defaultReward: "Bundle deal",
  },
};

export function campaignCopy(type: CampaignType | string | null | undefined): CampaignCopy {
  const key = (type === "B1F1" || type === "BUNDLE" ? type : "STAMP") as CampaignType;
  return { type: key, ...COPY[key] };
}

export function normalizeBrandColor(raw: string | null | undefined) {
  const v = String(raw || "").trim();
  if (!v) return null;
  const hex = v.startsWith("#") ? v : `#${v}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  return hex.toLowerCase();
}

export function normalizeLogoUrl(raw: string | null | undefined) {
  const v = String(raw || "").trim();
  if (!v) return null;
  if (v.length > 500) return null;
  if (!/^https?:\/\//i.test(v)) return null;
  return v;
}

export const CAMPAIGN_OPTIONS: { value: CampaignType; label: string }[] = [
  { value: "STAMP", label: "Stamp card" },
  { value: "B1F1", label: "Buy 1 Free 1" },
  { value: "BUNDLE", label: "Bundle / set" },
];
