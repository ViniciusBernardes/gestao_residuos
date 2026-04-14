/** Data local em yyyy-mm-dd */
export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Ultimo dia do mes civil de `d` (yyyy-mm-dd, fuso local). */
export function endOfMonthYmd(d: Date): string {
  const y = d.getFullYear();
  const mo1 = d.getMonth() + 1;
  const lastDay = new Date(y, mo1, 0).getDate();
  return `${y}-${String(mo1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Normaliza o fim de período: qualquer dia escolhido vira o último dia daquele mês.
 * `ymd` deve ser yyyy-mm-dd (ex.: valor do input type="date").
 */
export function endOfMonthYmdFromPicker(ymd: string): string {
  const [ys, ms] = ymd.split('-');
  const y = parseInt(ys ?? '', 10);
  const mo = parseInt(ms ?? '', 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return ymd;
  const lastDay = new Date(y, mo, 0).getDate();
  return `${y}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}
