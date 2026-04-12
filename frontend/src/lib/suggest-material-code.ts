/** Máximo alinhado a `code` no Prisma (VarChar 32). */
const MAX_LEN = 32;

/**
 * Sugere código a partir das iniciais das palavras do nome (letras e números).
 * Ex.: "Papelão ondulado" → "PO", "Plástico tipo 2" → "PT2".
 */
export function suggestMaterialCodeFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';

  const parts = trimmed.split(/[\s\-_/]+/).filter((w) => w.length > 0);
  let out = '';

  for (const part of parts) {
    for (const ch of part) {
      const base = ch.normalize('NFD').replace(/\p{M}/gu, '');
      const u = base.charAt(0).toUpperCase();
      if (/[A-Z0-9]/.test(u)) {
        out += u;
        break;
      }
    }
  }

  return out.slice(0, MAX_LEN);
}
