export type CardTheme = "classic" | "bold" | "ticket" | "soft";

export type BrandFont =
  | "syne"
  | "bricolage"
  | "fraunces"
  | "space-grotesk"
  | "dm-sans";

export const CARD_THEMES: {
  value: CardTheme;
  label: string;
  blurb: string;
}[] = [
  { value: "classic", label: "Classic", blurb: "Rounded gradient card" },
  { value: "bold", label: "Bold", blurb: "High contrast block" },
  { value: "ticket", label: "Ticket", blurb: "Notched pass style" },
  { value: "soft", label: "Soft", blurb: "Light surface, tinted ink" },
];

export const BRAND_FONTS: {
  value: BrandFont;
  label: string;
  css: string;
  google: string;
}[] = [
  {
    value: "syne",
    label: "Syne",
    css: '"Syne", sans-serif',
    google: "Syne:wght@600;700;800",
  },
  {
    value: "bricolage",
    label: "Bricolage",
    css: '"Bricolage Grotesque", sans-serif',
    google: "Bricolage+Grotesque:opsz,wght@12..96,600;700;800",
  },
  {
    value: "fraunces",
    label: "Fraunces",
    css: '"Fraunces", serif',
    google: "Fraunces:opsz,wght@9..144,600;700",
  },
  {
    value: "space-grotesk",
    label: "Space Grotesk",
    css: '"Space Grotesk", sans-serif',
    google: "Space+Grotesk:wght@500;600;700",
  },
  {
    value: "dm-sans",
    label: "DM Sans",
    css: '"DM Sans", sans-serif',
    google: "DM+Sans:wght@500;600;700",
  },
];

export function normalizeCardTheme(raw: string | null | undefined): CardTheme {
  const v = String(raw || "").toLowerCase();
  if (v === "bold" || v === "ticket" || v === "soft") return v;
  return "classic";
}

export function normalizeBrandFont(raw: string | null | undefined): BrandFont {
  const v = String(raw || "").toLowerCase();
  if (
    v === "bricolage" ||
    v === "fraunces" ||
    v === "space-grotesk" ||
    v === "dm-sans"
  ) {
    return v;
  }
  return "syne";
}

export function fontCss(raw: string | null | undefined) {
  const key = normalizeBrandFont(raw);
  return BRAND_FONTS.find((f) => f.value === key)?.css || BRAND_FONTS[0].css;
}

export function fontGoogleHref(raw: string | null | undefined) {
  const key = normalizeBrandFont(raw);
  const family = BRAND_FONTS.find((f) => f.value === key)?.google;
  if (!family) return null;
  return `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
}
