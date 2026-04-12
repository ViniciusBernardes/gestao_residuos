/**
 * Números no padrão brasileiro: vírgula decimal, ponto para milhar (ex.: 1.234,56).
 * Sem vírgula, um único ponto seguido de exatamente 3 dígitos é separador de milhar (1.200 → 1200),
 * exceto quando a parte inteira é só zeros (0.001 → valor decimal).
 */

export function parseBrDecimal(raw: string): number {
  let s = raw.trim().replace(/\s/g, '');
  if (!s || s === '-') return NaN;
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1).trim();
  if (!s) return NaN;

  let n: number;
  if (s.includes(',')) {
    const c = s.indexOf(',');
    let intS = s.slice(0, c).replace(/\./g, '').replace(/\D/g, '');
    const fracS = s.slice(c + 1).replace(/\D/g, '');
    if (intS === '') intS = '0';
    intS = intS.replace(/^0+(?=\d)/, '') || '0';
    if (fracS === '') {
      n = Number(intS);
    } else {
      n = Number(`${intS}.${fracS}`);
    }
  } else {
    n = parseBrDecimalNoComma(s);
  }
  if (!Number.isFinite(n)) return NaN;
  return neg ? -n : n;
}

/** Trecho sem vírgula decimal: apenas dígitos e pontos. */
function parseBrDecimalNoComma(s: string): number {
  const parts = s.split('.');
  if (parts.length === 1) {
    const intS = parts[0].replace(/\D/g, '');
    return intS === '' ? NaN : Number(intS);
  }
  if (parts.length === 2) {
    const a = parts[0].replace(/\D/g, '');
    const b = parts[1].replace(/\D/g, '');
    if (b === '') {
      return a === '' ? NaN : Number(a);
    }
    if (b.length < 3) {
      const singleDigitInt = /^[1-9]$/.test(a);
      const twoDigitPureDecimal = b.length === 2 && /^[1-9][1-9]$/.test(b);
      if (singleDigitInt && b !== '' && !twoDigitPureDecimal) {
        return Number(a + b);
      }
      if (a === '') return Number(`0.${b}`);
      return Number(`${a}.${b}`);
    }
    if (b.length === 3) {
      const thousands = a !== '' && /^[1-9]\d*$/.test(a);
      if (thousands) {
        return Number(a + b);
      }
      if (a === '') return Number(b);
      return Number(`${a}.${b}`);
    }
    if (a === '') return Number(`0.${b}`);
    return Number(`${a}.${b}`);
  }
  const all = parts.map((p) => p.replace(/\D/g, '')).join('');
  return all === '' ? NaN : Number(all);
}

export function formatBrDecimal(
  n: number,
  options?: { maxFractionDigits?: number; minFractionDigits?: number },
): string {
  if (!Number.isFinite(n)) return '';
  const maxFractionDigits = options?.maxFractionDigits ?? 6;
  const minFractionDigits = options?.minFractionDigits ?? 0;
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
    useGrouping: true,
  });
}

function groupIntDigits(digits: string): string {
  if (!digits) return '';
  let d = digits;
  if (d.length > 1) {
    d = d.replace(/^0+(?=\d)/, '') || '0';
  }
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export type MaskBrDecimalOptions = {
  allowNegative?: boolean;
  maxFractionDigits?: number;
};

/**
 * Máscara na digitação: milhares com ponto, vírgula decimal.
 * Não converte "12." em "12," — o ponto final continua indicando milhar em digitação (ex.: 1.200).
 */
export function maskBrDecimalString(raw: string, options?: MaskBrDecimalOptions): string {
  const maxFd = options?.maxFractionDigits ?? 6;
  const allowNegative = options?.allowNegative ?? false;

  let s = raw.replace(/\s/g, '');
  if (!s) return '';

  const neg = allowNegative && s.startsWith('-');
  s = neg ? s.slice(1) : s;
  if (!s) return neg ? '-' : '';

  s = s.replace(/[^\d.,]/g, '');
  if (!s) return neg ? '-' : '';

  let preserveTrailingDot = false;
  if (!s.includes(',') && s.endsWith('.')) {
    const core = s.slice(0, -1);
    if (core !== '' && /^\d[\d.]*$/.test(core)) {
      s = core;
      preserveTrailingDot = true;
    }
  }

  const endsWithComma = s.endsWith(',');

  let intDigits = '';
  let fracDigits = '';
  let hadComma = false;

  const commaIdx = s.indexOf(',');
  if (commaIdx !== -1) {
    hadComma = true;
    intDigits = s.slice(0, commaIdx).replace(/\D/g, '');
    fracDigits = s.slice(commaIdx + 1).replace(/\D/g, '').slice(0, maxFd);
  } else {
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount === 1) {
      const [a, b] = s.split('.');
      const ad = a.replace(/\D/g, '');
      const bd = b.replace(/\D/g, '');
      const singleDigitInt = /^[1-9]$/.test(ad);
      /** Ex.: 9,99 — dois dígitos 1–9 após o ponto é decimal, não 999. */
      const twoDigitPureDecimal = bd.length === 2 && /^[1-9][1-9]$/.test(bd);
      const mergeAsInteger =
        singleDigitInt &&
        bd.length >= 1 &&
        bd.length <= 3 &&
        !twoDigitPureDecimal;
      if (mergeAsInteger) {
        intDigits = ad + bd;
      } else if (bd.length > 0 && bd.length <= maxFd) {
        intDigits = ad;
        fracDigits = bd.slice(0, maxFd);
        hadComma = true;
      } else {
        intDigits = s.replace(/\D/g, '');
      }
    } else {
      intDigits = s.replace(/\D/g, '');
    }
  }

  if (hadComma && intDigits === '' && fracDigits === '') {
    return (neg ? '-' : '') + '0' + (endsWithComma ? ',' : '');
  }
  if (hadComma && intDigits === '' && fracDigits !== '') {
    intDigits = '0';
  }

  const intGrouped = intDigits ? groupIntDigits(intDigits) : '';
  const prefix = neg ? '-' : '';

  if (!hadComma) {
    let out = prefix + intGrouped;
    if (preserveTrailingDot && intDigits !== '') {
      out += '.';
    }
    return out;
  }

  if (endsWithComma && fracDigits === '') {
    return prefix + (intGrouped || '0') + ',';
  }

  return prefix + (intGrouped || '0') + ',' + fracDigits;
}

/** @deprecated use maskBrDecimalString */
export function sanitizeBrDecimalInput(
  raw: string,
  options?: { allowNegative?: boolean },
): string {
  return maskBrDecimalString(raw, { allowNegative: options?.allowNegative, maxFractionDigits: 20 });
}
