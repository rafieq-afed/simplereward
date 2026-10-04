import { Role } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  welcomeNote: z.string().max(255).optional().nullable(),
  requireJoinOtp: z.boolean().optional(),
  brandColor: z.string().max(7).optional().nullable(),
  logoUrl: z.string().max(500).optional().nullable(),
  cardTheme: z.enum(["classic", "bold", "ticket", "soft"]).optional(),
  fontFamily: z
    .enum(["syne", "bricolage", "fraunces", "space-grotesk", "dm-sans"])
    .optional(),
  instagramUrl: z.string().max(500).optional().nullable(),
  facebookUrl: z.string().max(500).optional().nullable(),
  tiktokUrl: z.string().max(500).optional().nullable(),
  whatsappUrl: z.string().max(500).optional().nullable(),
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event, Role.MERCHANT);
  if (!session.merchantId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid settings" });
  }

  const { features } = await getMerchantFeatures(session.merchantId);

  if (!hasFeature(features, "brandKit")) {
    if (parsed.data.logoUrl?.trim()) {
      await requireFeature(event, session.merchantId, "brandKit");
    }
    if (parsed.data.cardTheme && parsed.data.cardTheme !== "classic") {
      await requireFeature(event, session.merchantId, "brandKit");
    }
    if (parsed.data.fontFamily && parsed.data.fontFamily !== "syne") {
      await requireFeature(event, session.merchantId, "brandKit");
    }
  }

  if (!hasFeature(features, "socialLinks")) {
    const anySocial = [
      parsed.data.instagramUrl,
      parsed.data.facebookUrl,
      parsed.data.tiktokUrl,
      parsed.data.whatsappUrl,
    ].some((v) => typeof v === "string" && v.trim());
    if (anySocial) await requireFeature(event, session.merchantId, "socialLinks");
  }

  if (parsed.data.requireJoinOtp === true && !hasFeature(features, "joinOtp")) {
    await requireFeature(event, session.merchantId, "joinOtp");
  }

  const brandColor =
    parsed.data.brandColor === undefined
      ? undefined
      : normalizeBrandColor(parsed.data.brandColor);
  let logoUrl: string | null | undefined = undefined;
  if (parsed.data.logoUrl !== undefined) {
    const raw = parsed.data.logoUrl?.trim() || null;
    if (!raw) logoUrl = null;
    else if (raw.startsWith("/uploads/")) logoUrl = raw.slice(0, 500);
    else logoUrl = normalizeLogoUrl(raw);
    if (parsed.data.logoUrl?.trim() && logoUrl === null) {
      throw createError({
        statusCode: 400,
        statusMessage: "Logo must be uploaded or a full http(s) URL",
      });
    }
  }

  if (parsed.data.brandColor && parsed.data.brandColor.trim() && brandColor === null) {
    throw createError({ statusCode: 400, statusMessage: "Brand color must be hex like #1f7a57" });
  }

  function socialOrThrow(
    raw: string | null | undefined,
    normalize: (v: string | null | undefined) => string | null,
    label: string,
  ) {
    if (raw === undefined) return undefined;
    const trimmed = raw?.trim() || null;
    if (!trimmed) return null;
    const next = normalize(trimmed);
    if (!next) {
      throw createError({ statusCode: 400, statusMessage: `Invalid ${label}` });
    }
    return next;
  }

  const instagramUrl = socialOrThrow(
    parsed.data.instagramUrl,
    normalizeInstagram,
    "Instagram",
  );
  const facebookUrl = socialOrThrow(
    parsed.data.facebookUrl,
    normalizeFacebook,
    "Facebook",
  );
  const tiktokUrl = socialOrThrow(parsed.data.tiktokUrl, normalizeTiktok, "TikTok");
  const whatsappUrl = socialOrThrow(
    parsed.data.whatsappUrl,
    normalizeWhatsapp,
    "WhatsApp",
  );

  const merchant = await prisma.merchant.update({
    where: { id: session.merchantId },
    data: {
      ...(parsed.data.welcomeNote !== undefined
        ? { welcomeNote: parsed.data.welcomeNote?.trim() || null }
        : {}),
      ...(parsed.data.requireJoinOtp !== undefined
        ? { requireJoinOtp: parsed.data.requireJoinOtp }
        : {}),
      ...(brandColor !== undefined ? { brandColor } : {}),
      ...(logoUrl !== undefined ? { logoUrl } : {}),
      ...(parsed.data.cardTheme
        ? { cardTheme: normalizeCardTheme(parsed.data.cardTheme) }
        : {}),
      ...(parsed.data.fontFamily
        ? { fontFamily: normalizeBrandFont(parsed.data.fontFamily) }
        : {}),
      ...(instagramUrl !== undefined ? { instagramUrl } : {}),
      ...(facebookUrl !== undefined ? { facebookUrl } : {}),
      ...(tiktokUrl !== undefined ? { tiktokUrl } : {}),
      ...(whatsappUrl !== undefined ? { whatsappUrl } : {}),
    },
  });

  return { merchant };
});
