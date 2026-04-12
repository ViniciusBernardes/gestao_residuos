'use client';

import { formatBrDecimal, maskBrDecimalString, parseBrDecimal } from '@/lib/br-decimal';

type Props = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  allowNegative?: boolean;
  className?: string;
  required?: boolean;
  placeholder?: string;
  maxFractionDigits?: number;
  /** Casas decimais mínimas ao sair do campo (ex.: 2 → 1.200,00). Padrão: 2. Use 0 para não forçar. */
  minFractionDigitsOnBlur?: number;
  disabled?: boolean;
};

/**
 * Campo decimal no padrão brasileiro (milhar com ponto, decimais com vírgula).
 * Use em todo o sistema para quantidades e valores monetários.
 */
export function BrDecimalInput({
  value,
  onChange,
  allowNegative,
  className = '',
  required,
  placeholder,
  id,
  maxFractionDigits = 6,
  minFractionDigitsOnBlur = 2,
  disabled,
}: Props) {
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      lang="pt-BR"
      className={className}
      required={required}
      placeholder={placeholder}
      disabled={disabled}
      value={value}
      onChange={(e) =>
        onChange(
          maskBrDecimalString(e.target.value, { allowNegative, maxFractionDigits: maxFractionDigits }),
        )
      }
      onBlur={() => {
        if (!value.trim()) return;
        const n = parseBrDecimal(value);
        if (Number.isFinite(n)) {
          onChange(
            formatBrDecimal(n, {
              maxFractionDigits,
              minFractionDigits: minFractionDigitsOnBlur,
            }),
          );
        }
      }}
    />
  );
}
