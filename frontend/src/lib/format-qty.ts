import { parseBrDecimal } from './br-decimal';

const qtyLocaleOpts: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

/** Formata quantidade (string da API ou já em pt-BR) para exibição — sempre 2 casas decimais. */
export function formatQty(s: string) {
  const n = parseBrDecimal(s);
  if (Number.isFinite(n)) return n.toLocaleString('pt-BR', qtyLocaleOpts);
  const fallback = Number(s);
  if (Number.isFinite(fallback)) return fallback.toLocaleString('pt-BR', qtyLocaleOpts);
  return s;
}
