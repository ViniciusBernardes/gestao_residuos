type CnaeSecRow = { codigo?: number | string | null; descricao?: string | null };

function formatCnaeCode(v: unknown): string {
  if (v == null || v === '') return '—';
  const raw = String(v).replace(/\D/g, '');
  if (!raw) return '—';
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return '—';
  return String(n).padStart(7, '0');
}

type Props = {
  receitaPayload: Record<string, unknown> | null | undefined;
  title?: string;
};

export function CnaeActivitiesTable({
  receitaPayload,
  title = 'Atividades CNAE (dados públicos do CNPJ)',
}: Props) {
  if (!receitaPayload) return null;

  const principalCode = receitaPayload.cnae_fiscal;
  const principalDesc = String(receitaPayload.cnae_fiscal_descricao ?? '').trim();
  const hasPrincipal =
    (principalCode != null && principalCode !== '') || principalDesc.length > 0;

  const rawSec = receitaPayload.cnaes_secundarios;
  const secondaries: CnaeSecRow[] = Array.isArray(rawSec) ? (rawSec as CnaeSecRow[]) : [];

  const secondaryRows = secondaries
    .map((c) => ({
      code: formatCnaeCode(c?.codigo),
      desc: String(c?.descricao ?? '').trim(),
    }))
    .filter((r) => r.code !== '—' || r.desc.length > 0);

  if (!hasPrincipal && secondaryRows.length === 0) return null;

  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">
      <div className="font-semibold text-slate-700 mb-2">{title}</div>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[280px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th scope="col" className="py-2 pr-3 font-medium align-bottom">
                Classificação
              </th>
              <th scope="col" className="py-2 pr-3 font-medium whitespace-nowrap align-bottom">
                CNAE
              </th>
              <th scope="col" className="py-2 font-medium align-bottom">
                Descrição
              </th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {hasPrincipal && (
              <tr className="border-b border-slate-100 align-top">
                <td className="py-2 pr-3 font-medium text-slate-800 whitespace-nowrap">
                  Principal
                </td>
                <td className="py-2 pr-3 font-mono tabular-nums whitespace-nowrap">
                  {formatCnaeCode(principalCode)}
                </td>
                <td className="py-2">{principalDesc || '—'}</td>
              </tr>
            )}
            {secondaryRows.map((r, i) => (
              <tr
                key={`${r.code}-${i}`}
                className="border-b border-slate-100 last:border-0 align-top"
              >
                <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">Secundária</td>
                <td className="py-2 pr-3 font-mono tabular-nums whitespace-nowrap">{r.code}</td>
                <td className="py-2">{r.desc || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
