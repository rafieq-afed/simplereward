import type { H3Event } from "h3";
import {
  FEATURE_CATALOG,
  TIER_TEMPLATES,
  enabledFeatureCount,
  featureLimits,
  featuresFromTier,
  hasFeature,
  normalizeFeatures,
  parseFeaturePatch,
  priceFor,
  tierSuggestedPrice,
  type FeatureKey,
  type FeatureMap,
} from "#shared/features";

export {
  FEATURE_CATALOG,
  TIER_TEMPLATES,
  enabledFeatureCount,
  featureLimits,
  featuresFromTier,
  hasFeature,
  normalizeFeatures,
  parseFeaturePatch,
  priceFor,
  tierSuggestedPrice,
  type FeatureKey,
  type FeatureMap,
};

export async function getMerchantFeatures(merchantId: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { features: true, quotedPrice: true },
  });
  if (!merchant) {
    throw createError({ statusCode: 404, statusMessage: "Merchant missing" });
  }
  const features = normalizeFeatures(merchant.features);
  return {
    features,
    quotedPrice: merchant.quotedPrice ?? priceFor(features),
    limits: featureLimits(features),
  };
}

export async function requireFeature(
  event: H3Event,
  merchantId: string,
  key: FeatureKey,
) {
  const { features } = await getMerchantFeatures(merchantId);
  if (!hasFeature(features, key)) {
    const label = FEATURE_CATALOG.find((f) => f.key === key)?.label || key;
    throw createError({
      statusCode: 403,
      statusMessage: `Upgrade required: ${label}`,
    });
  }
  return features;
}

export function featuresPayload(features: FeatureMap, quotedPrice?: number) {
  return {
    features: normalizeFeatures(features),
    quotedPrice: quotedPrice ?? priceFor(features),
    catalog: FEATURE_CATALOG,
    templates: TIER_TEMPLATES.map((t) => ({
      ...t,
      suggestedPrice: priceFor(
        Object.fromEntries(t.features.map((k) => [k, true])),
      ),
    })),
    limits: featureLimits(features),
  };
}
