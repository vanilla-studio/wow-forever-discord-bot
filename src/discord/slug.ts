// Normalizes user input into the Forever API slug "{name}-{surname}".
// Accepts "Raekwon Rosebrook", "raekwon-rosebrook", " Raekwon  Rosebrook ", etc.
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// A valid Forever slug is "name-surname": two lowercase parts joined by a dash.
// Letters cover accented names; no digits or other punctuation.
const SLUG_RE = /^[\p{L}]+-[\p{L}]+$/u;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}
