import Link from 'next/link';

type Props = {
  /** Ex.: `py-2` para alinhar a botões menores */
  className?: string;
};

const baseClass =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50';

export function CancelToDashboard({ className }: Props) {
  return (
    <Link href="/dashboard" className={className ? `${baseClass} ${className}` : baseClass}>
      Cancelar
    </Link>
  );
}
