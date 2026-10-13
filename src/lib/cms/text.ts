// Small helpers shared by the CMS editors (client + server safe).

/** URL slug from an English name: "Saffron Crème Brûlée" → "saffron-creme-brulee". */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** "12", "12.5", "12,50", "$12.50" → 1250 cents. null if not a valid non-negative amount. */
export function parsePriceToCents(input: string): number | null {
  if (input.includes("-")) return null; // no negative prices
  const cleaned = input
    .trim()
    .replace(/[^\d.,]/g, "")
    .replace(",", ".");
  if (!/^\d{1,5}(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export const centsToInput = (cents: number) => (cents / 100).toFixed(2);
