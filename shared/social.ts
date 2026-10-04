export type SocialLinks = {
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  whatsappUrl: string | null;
};

function asHttpUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString().slice(0, 500);
  } catch {
    return null;
  }
}

/** Accept full URL, @handle, or bare username. */
export function normalizeInstagram(raw: string | null | undefined) {
  const v = String(raw || "").trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return asHttpUrl(v);
  const handle = v.replace(/^@/, "").replace(/^instagram\.com\//i, "").split(/[/?#]/)[0];
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
  return `https://instagram.com/${handle}`;
}

export function normalizeFacebook(raw: string | null | undefined) {
  const v = String(raw || "").trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return asHttpUrl(v);
  const page = v.replace(/^@/, "").replace(/^(www\.)?facebook\.com\//i, "").split(/[/?#]/)[0];
  if (!page || page.length > 80) return null;
  return `https://facebook.com/${encodeURIComponent(page)}`;
}

export function normalizeTiktok(raw: string | null | undefined) {
  const v = String(raw || "").trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return asHttpUrl(v);
  const handle = v.replace(/^@/, "").replace(/^(www\.)?tiktok\.com\/@?/i, "").split(/[/?#]/)[0];
  if (!/^[A-Za-z0-9._]{2,24}$/.test(handle)) return null;
  return `https://www.tiktok.com/@${handle}`;
}

/** Accept wa.me URL, +60…, or local 01x digits. */
export function normalizeWhatsapp(raw: string | null | undefined) {
  const v = String(raw || "").trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) {
    const url = asHttpUrl(v);
    if (!url) return null;
    if (!/wa\.me|api\.whatsapp\.com|whatsapp\.com/i.test(url)) return null;
    return url;
  }
  let digits = v.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 11) {
    digits = `60${digits.slice(1)}`;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}`;
}

export function hasAnySocial(links: Partial<SocialLinks> | null | undefined) {
  if (!links) return false;
  return Boolean(
    links.instagramUrl || links.facebookUrl || links.tiktokUrl || links.whatsappUrl,
  );
}
