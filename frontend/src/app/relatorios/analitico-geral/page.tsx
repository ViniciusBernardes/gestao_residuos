'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { PaginationBar } from '@/components/PaginationBar';
import { api, apiBlob, getToken } from '@/lib/api';
import { parseBrDecimal } from '@/lib/br-decimal';
import { formatQty } from '@/lib/format-qty';
import { fetchItemsForSelect } from '@/lib/paginated-api';
import { endOfMonthYmd, endOfMonthYmdFromPicker, localYmd } from '@/lib/report-dates';
import { canView } from '@/lib/permissions';

type Row = {
  materialCode: string | null;
  materialName: string;
  materialDescription: string | null;
  materialTypeName: string;
  unitCode: string;
  depositCode: string | null;
  depositName: string;
  entradas: string;
  saidas: string;
  transferenciasSaida: string;
  transferenciasEntrada: string;
  saldoLiquidoPeriodo: string;
};

type SummaryByUnit = {
  unitCode: string;
  totalEntradas: string;
  totalSaidas: string;
  totalTransferenciasSaida: string;
  totalTransferenciasEntrada: string;
  saldoLiquidoPeriodo: string;
};

type ReportPayload = {
  period: { from: string; to: string };
  rows: Row[];
  summary: {
    revenueTotal: string;
    byUnit: SummaryByUnit[];
  };
};

function formatBrlFromApiDecimal(s: string): string {
  const n = parseBrDecimal(s);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type TableSortKey =
  | 'code'
  | 'description'
  | 'type'
  | 'deposit'
  | 'unit'
  | 'entradas'
  | 'saidas'
  | 'transfOut'
  | 'transfIn'
  | 'liquido';

function qtyNum(s: string): number {
  const n = parseBrDecimal(s);
  return Number.isFinite(n) ? n : 0;
}

export default function RelatorioAnaliticoGeralPage() {
  const router = useRouter();
  const [materialTypes, setMaterialTypes] = useState<{ id: string; name: string }[]>([]);
  const [deposits, setDeposits] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [err, setErr] = useState('');
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportPayload | null>(null);

  const today = new Date();
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [materialTypeId, setMaterialTypeId] = useState('');
  const [dateFrom, setDateFrom] = useState(localYmd(startMonth));
  const [dateTo, setDateTo] = useState(endOfMonthYmd(today));
  const [depositId, setDepositId] = useState('');
  const [sortBy, setSortBy] = useState<'code' | 'description'>('code');

  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tableSortKey, setTableSortKey] = useState<TableSortKey>('code');
  const [tableSortDir, setTableSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!canView('relatorios')) {
      router.replace('/dashboard');
      return;
    }
    Promise.all([
      fetchItemsForSelect<{ id: string; name: string }>('/material-types'),
      fetchItemsForSelect<{ id: string; tradeName: string; code: string | null }>(
        '/establishments?role=DEPOSIT',
      ).then((rows) =>
        rows.map((r) => ({ id: r.id, name: r.tradeName, code: r.code })),
      ),
    ])
      .then(([mt, dep]) => {
        setMaterialTypes(mt);
        setDeposits(dep);
      })
      .catch(() => {});
  }, [router]);

  const runReport = useCallback(async () => {
    setErr('');
    setData(null);
    if (!dateFrom || !dateTo) {
      setErr('Informe o período inicial e final.');
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({
        dateFrom,
        dateTo,
        sortBy,
      });
      if (materialTypeId) q.set('materialTypeId', materialTypeId);
      if (depositId) q.set('depositId', depositId);
      const res = await api<ReportPayload>(`/reports/analytical-general?${q.toString()}`);
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, materialTypeId, depositId, sortBy]);

  const sortedRows = useMemo(() => {
    if (!data?.rows.length) return [];
    const rows = [...data.rows];
    const dir = tableSortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let c = 0;
      switch (tableSortKey) {
        case 'code':
          c = (a.materialCode ?? '').localeCompare(b.materialCode ?? '', 'pt-BR', { numeric: true });
          break;
        case 'description':
          c = a.materialName.localeCompare(b.materialName, 'pt-BR');
          break;
        case 'type':
          c = a.materialTypeName.localeCompare(b.materialTypeName, 'pt-BR');
          break;
        case 'deposit': {
          const da = a.depositCode ? `${a.depositCode} ${a.depositName}` : a.depositName;
          const db = b.depositCode ? `${b.depositCode} ${b.depositName}` : b.depositName;
          c = da.localeCompare(db, 'pt-BR');
          break;
        }
        case 'unit':
          c = a.unitCode.localeCompare(b.unitCode, 'pt-BR');
          break;
        case 'entradas':
          c = qtyNum(a.entradas) - qtyNum(b.entradas);
          break;
        case 'saidas':
          c = qtyNum(a.saidas) - qtyNum(b.saidas);
          break;
        case 'transfOut':
          c = qtyNum(a.transferenciasSaida) - qtyNum(b.transferenciasSaida);
          break;
        case 'transfIn':
          c = qtyNum(a.transferenciasEntrada) - qtyNum(b.transferenciasEntrada);
          break;
        case 'liquido':
          c = qtyNum(a.saldoLiquidoPeriodo) - qtyNum(b.saldoLiquidoPeriodo);
          break;
        default:
          c = 0;
      }
      if (c !== 0) return dir * c;
      return a.materialName.localeCompare(b.materialName, 'pt-BR');
    });
    return rows;
  }, [data, tableSortKey, tableSortDir]);

  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const effectivePage = Math.min(Math.max(1, tablePage), totalPages);

  const pagedRows = useMemo(() => {
    const start = (effectivePage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, effectivePage, pageSize]);

  useEffect(() => {
    if (!data) return;
    setTablePage(1);
    setTableSortKey(sortBy === 'description' ? 'description' : 'code');
    setTableSortDir('asc');
  }, [data, sortBy]);

  function toggleColumnSort(key: TableSortKey) {
    if (tableSortKey === key) {
      setTableSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setTableSortKey(key);
      setTableSortDir('asc');
    }
    setTablePage(1);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void runReport();
  }

  function buildExportQuery(): string {
    const q = new URLSearchParams({
      dateFrom,
      dateTo,
      sortBy,
    });
    if (materialTypeId) q.set('materialTypeId', materialTypeId);
    if (depositId) q.set('depositId', depositId);
    return q.toString();
  }

  async function downloadExport(kind: 'xlsx' | 'pdf') {
    setErr('');
    if (!dateFrom || !dateTo) {
      setErr('Informe o período inicial e final.');
      return;
    }
    setExporting(kind);
    try {
      const qs = buildExportQuery();
      const path =
        kind === 'xlsx'
          ? `/reports/export/analytical-general.xlsx?${qs}`
          : `/reports/export/analytical-general.pdf?${qs}`;
      const blob = await apiBlob(path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = kind === 'xlsx' ? 'analitico-geral.xlsx' : 'analitico-geral.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao exportar');
    } finally {
      setExporting(null);
    }
  }

  if (!getToken() || !canView('relatorios')) return null;

  return (
    <div>
      <Link href="/relatorios" className="text-sm text-brand-700 hover:underline">
        ← Downloads
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Relatório analítico geral</h1>
      <p className="text-slate-600 text-sm mt-1">
        Visão consolidada por material e depósito. Ajustes entram na coluna Entradas; resumo de totais ao final.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 max-w-4xl"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="text-xs text-slate-600">Tipo de material</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={materialTypeId}
              onChange={(e) => setMaterialTypeId(e.target.value)}
            >
              <option value="">Todos</option>
              {materialTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600">Período inicial</label>
            <input
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-600">Período final</label>
            <input
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={dateTo}
              onChange={(e) => setDateTo(endOfMonthYmdFromPicker(e.target.value))}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="text-xs text-slate-600">Depósito</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={depositId}
              onChange={(e) => setDepositId(e.target.value)}
            >
              <option value="">Todos</option>
              {deposits.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code ? `${d.code} — ${d.name}` : d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <span className="text-xs text-slate-600">Ordenação</span>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sortBy"
                  checked={sortBy === 'code'}
                  onChange={() => setSortBy('code')}
                />
                Código do material
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sortBy"
                  checked={sortBy === 'description'}
                  onChange={() => setSortBy('description')}
                />
                Descrição (nome)
              </label>
            </div>
          </div>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Gerando…' : 'Gerar relatório'}
          </button>
          <button
            type="button"
            disabled={loading || !!exporting}
            onClick={() => void downloadExport('xlsx')}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting === 'xlsx' ? 'Exportando…' : 'Exportar Excel'}
          </button>
          <button
            type="button"
            disabled={loading || !!exporting}
            onClick={() => void downloadExport('pdf')}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting === 'pdf' ? 'Exportando…' : 'Exportar PDF'}
          </button>
        </div>
      </form>

      {data && (
        <div className="mt-8 text-sm">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Relatório analítico</h2>
                <p className="text-slate-600 text-sm mt-1">
                  Período:{' '}
                  {new Date(data.period.from).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}{' '}
                  a{' '}
                  {new Date(data.period.to).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  <span className="text-slate-500"> · {data.rows.length} registro(s)</span>
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <span>Itens por página</span>
                <select
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setTablePage(1);
                  }}
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto shadow-sm">
              <table className="w-full text-left min-w-[960px]">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">
                  <tr>
                    <ThSort
                      label="Código"
                      sortKey="code"
                      activeKey={tableSortKey}
                      dir={tableSortDir}
                      onSort={toggleColumnSort}
                    />
                    <ThSort
                      label="Material"
                      sortKey="description"
                      activeKey={tableSortKey}
                      dir={tableSortDir}
                      onSort={toggleColumnSort}
                    />
                    <ThSort
                      label="Tipo mat."
                      sortKey="type"
                      activeKey={tableSortKey}
                      dir={tableSortDir}
                      onSort={toggleColumnSort}
                    />
                    <ThSort
                      label="Depósito"
                      sortKey="deposit"
                      activeKey={tableSortKey}
                      dir={tableSortDir}
                      onSort={toggleColumnSort}
                    />
                    <ThSort
                      label="Unidade"
                      sortKey="unit"
                      activeKey={tableSortKey}
                      dir={tableSortDir}
                      onSort={toggleColumnSort}
                      align="center"
                    />
                    <ThSort
                      label="Entradas"
                      sortKey="entradas"
                      activeKey={tableSortKey}
                      dir={tableSortDir}
                      onSort={toggleColumnSort}
                      align="right"
                    />
                    <ThSort
                      label="Saídas"
                      sortKey="saidas"
                      activeKey={tableSortKey}
                      dir={tableSortDir}
                      onSort={toggleColumnSort}
                      align="right"
                    />
                    <ThSort
                      label="Transf. saída"
                      sortKey="transfOut"
                      activeKey={tableSortKey}
                      dir={tableSortDir}
                      onSort={toggleColumnSort}
                      align="right"
                    />
                    <ThSort
                      label="Transf. entrada"
                      sortKey="transfIn"
                      activeKey={tableSortKey}
                      dir={tableSortDir}
                      onSort={toggleColumnSort}
                      align="right"
                    />
                    <ThSort
                      label="Líquido no período"
                      sortKey="liquido"
                      activeKey={tableSortKey}
                      dir={tableSortDir}
                      onSort={toggleColumnSort}
                      align="right"
                    />
                  </tr>
                </thead>
                <tbody className="bg-white text-slate-800">
                  {data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-slate-500">
                        Nenhuma movimentação no período com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((r, i) => (
                      <tr
                        key={`${r.materialName}-${r.depositName}-${i}`}
                        className="border-t border-slate-100 hover:bg-slate-50/80"
                      >
                        <td className="px-3 py-2 tabular-nums text-slate-800">{r.materialCode ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-800">
                          <span className="font-medium">{r.materialName}</span>
                          {r.materialDescription && (
                            <span className="block text-xs text-slate-500 mt-0.5">{r.materialDescription}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{r.materialTypeName}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {r.depositCode ? `${r.depositCode} — ${r.depositName}` : r.depositName}
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums text-slate-700 font-medium">
                          {r.unitCode}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-800">{formatQty(r.entradas)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-800">{formatQty(r.saidas)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                          {formatQty(r.transferenciasSaida)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                          {formatQty(r.transferenciasEntrada)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                          {formatQty(r.saldoLiquidoPeriodo)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {totalRows > 0 && (
                <PaginationBar
                  page={effectivePage}
                  totalPages={totalPages}
                  total={totalRows}
                  limit={pageSize}
                  onPageChange={setTablePage}
                />
              )}
            </div>

            {data.summary && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/90 px-5 py-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 mb-3">
                  Resumo geral
                </h3>
                <div className="space-y-4 text-sm text-slate-700">
                  {data.summary.byUnit.length > 0 ? (
                    data.summary.byUnit.map((u) => (
                      <div key={u.unitCode}>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Unidade {u.unitCode}</p>
                        <ul className="space-y-1.5 list-none pl-0">
                          <li>
                            <span className="text-slate-600">Total de entradas:</span>{' '}
                            <span className="font-medium tabular-nums text-slate-900">
                              {formatQty(u.totalEntradas)}
                            </span>
                          </li>
                          <li>
                            <span className="text-slate-600">Total de saídas:</span>{' '}
                            <span className="font-medium tabular-nums text-slate-900">
                              {formatQty(u.totalSaidas)}
                            </span>
                          </li>
                          <li>
                            <span className="text-slate-600">Total transf. saída:</span>{' '}
                            <span className="font-medium tabular-nums text-slate-800">
                              {formatQty(u.totalTransferenciasSaida)}
                            </span>
                          </li>
                          <li>
                            <span className="text-slate-600">Total transf. entrada:</span>{' '}
                            <span className="font-medium tabular-nums text-slate-800">
                              {formatQty(u.totalTransferenciasEntrada)}
                            </span>
                          </li>
                          <li>
                            <span className="text-slate-600">Saldo líquido no período:</span>{' '}
                            <span className="font-semibold tabular-nums text-brand-700">
                              {formatQty(u.saldoLiquidoPeriodo)}
                            </span>
                          </li>
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 text-sm">Sem movimentação de quantidades no período.</p>
                  )}
                  <div className="pt-3 mt-3 border-t border-slate-200">
                    <p className="text-slate-600">
                      Receita total gerada{' '}
                      <span className="text-xs font-normal text-slate-500">(itens de saída com valor)</span>
                    </p>
                    <p className="text-lg font-semibold text-brand-700 tabular-nums mt-1">
                      {formatBrlFromApiDecimal(data.summary.revenueTotal)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ThSort({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: TableSortKey;
  activeKey: TableSortKey;
  dir: 'asc' | 'desc';
  onSort: (k: TableSortKey) => void;
  align?: 'left' | 'right' | 'center';
}) {
  const active = activeKey === sortKey;
  const thAlign =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const btnJustify =
    align === 'right' ? 'w-full justify-end' : align === 'center' ? 'w-full justify-center' : '';
  return (
    <th
      scope="col"
      className={`px-3 py-2 font-medium ${thAlign}`}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 max-w-full rounded px-0.5 py-0.5 -mx-0.5 uppercase tracking-wide hover:bg-slate-200/80 hover:text-slate-900 text-slate-600 ${btnJustify}`}
      >
        <span>{label}</span>
        <span className="text-[10px] opacity-70 tabular-nums shrink-0" aria-hidden>
          {active ? (dir === 'asc' ? '▲' : '▼') : '◇'}
        </span>
      </button>
    </th>
  );
}
