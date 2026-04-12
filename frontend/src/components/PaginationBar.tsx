'use client';

type Props = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (p: number) => void;
  /** Fundo escuro (ex.: relatórios). */
  variant?: 'light' | 'dark';
};

export function PaginationBar({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  variant = 'light',
}: Props) {
  if (totalPages <= 1 && total === 0) return null;

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const isDark = variant === 'dark';
  const wrap = isDark
    ? 'flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300'
    : 'flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-600';
  const strong = isDark ? 'text-slate-100' : 'text-slate-800';
  const btn = isDark
    ? 'rounded border border-slate-600 bg-slate-800 px-3 py-1 text-slate-200 disabled:opacity-40 hover:bg-slate-700'
    : 'rounded border border-slate-300 px-3 py-1 disabled:opacity-40 hover:bg-white';

  return (
    <div className={wrap}>
      <span>
        {total > 0 ? (
          <>
            Exibindo <strong className={strong}>{from}</strong>–<strong className={strong}>{to}</strong> de{' '}
            <strong className={strong}>{total}</strong>
          </>
        ) : (
          'Nenhum registro'
        )}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          className={btn}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </button>
        <span className="px-2">Página {page} / {Math.max(1, totalPages)}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          className={btn}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
