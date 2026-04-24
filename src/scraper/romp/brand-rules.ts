function normalizeBrandText(value: string): string {
  return String(value || '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

const ROMP_BRAND_HINTS = ['romp', '绒谱', '绒普', '绒镨', '绒潽'];

export function isRompBrandLikeText(value: string): boolean {
  const normalized = normalizeBrandText(value);
  if (!normalized) return false;
  return ROMP_BRAND_HINTS.some((hint) => normalized.includes(hint));
}
