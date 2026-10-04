/** Minimum seconds between EARN stamps for the same customer. */
export const STAMP_COOLDOWN_SEC = 90;

export function isDoubleStampActive(doubleStampOn: Date | null | undefined, now = new Date()) {
  if (!doubleStampOn) return false;
  return (
    doubleStampOn.getFullYear() === now.getFullYear() &&
    doubleStampOn.getMonth() === now.getMonth() &&
    doubleStampOn.getDate() === now.getDate()
  );
}

export function todayMd(now = new Date()) {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${m}-${d}`;
}

export function parseBirthdayMd(raw: string) {
  const m = String(raw || "")
    .trim()
    .match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
