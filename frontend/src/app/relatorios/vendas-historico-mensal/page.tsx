'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, getToken } from '@/lib/api';
import { formatBrDecimal, parseBrDecimal } from '@/lib/br-decimal';
import { fetchItemsForSelect } from '@/lib/paginated-api';
import { endOfMonthYmd, endOfMonthYmdFromPicker, localYmd } from '@/lib/report-dates';
import { canView } from '@/lib/permissions';

type QtyRow = { unitCode: string; quantity: string };

type MonthRow = {
  month: string;
  monthLabel: string;
  revenueTotal: string;
  quantities: QtyRow[];
};

type ChartPayload = {
  period: { from: string; to: string };
  depositId: string | null;
  byMonth: MonthRow[];
};

function qtyNum(s: string): number {
  const n = parseBrDecimal(s);
  return Number.isFinite(n) ? n : 0;
}

function moneyNum(s: string): number {
  const n = parseBrDecimal(s);
  return Number.isFinite(n) ? n : 0;
}

const UNIT_COLORS = ['#0d9488', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#4d7c0f', '#b45309'];

export default function RelatorioVendasHistoricoMensalPage() {
  const router = useRouter();
  const [deposits, setDeposits] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChartPayload | null>(null);

  const today = new Date();
  const startYear = new Date(today.getFullYear(), 0, 1);

  const [dateFrom, setDateFrom] = useState(localYmd(startYear));
  const [dateTo, setDateTo] = useState(endOfMonthYmd(today));
  const [depositId, setDepositId] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!canView('relatorios')) {
      router.replace('/dashboard');
      return;
    }
    fetchItemsForSelect<{ id: string; tradeName: string; code: string | null }>('/establishments?role=DEPOSIT')
      .then((rows) => rows.map((r) => ({ id: r.id, name: r.tradeName, code: r.code })))
      .then(setDeposits)
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
      const q = new URLSearchParams({ dateFrom, dateTo });
      if (depositId) q.set('depositId', depositId);
      const res = await api<ChartPayload>(`/reports/recycled-sales-monthly-chart?${q.toString()}`);
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, depositId]);

  const unitCodes = useMemo(() => {
    if (!data?.byMonth.length) return [] as string[];
    const s = new Set<string>();
    for (const r of data.byMonth) {
      for (const q of r.quantities) s.add(q.unitCode);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [data]);

  const qtyStackData = useMemo(() => {
    if (!data?.byMonth.length) return [];
    return data.byMonth.map((r) => {
      const row: Record<string, string | number> = { name: r.monthLabel };
      for (const u of unitCodes) {
        const found = r.quantities.find((x) => x.unitCode === u);
        row[u] = found ? qtyNum(found.quantity) : 0;
      }
      return row;
    });
  }, [data, unitCodes]);

  const revenueLineData = useMemo(() => {
    if (!data?.byMonth.length) return [];
    return data.byMonth.map((r) => ({
      name: r.monthLabel,
      receita: moneyNum(r.revenueTotal),
    }));
  }, [data]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void runReport();
  }

  if (!getToken() || !canView('relatorios')) return null;

  const hasAnyQty = unitCodes.length > 0 && qtyStackData.some((row) => unitCodes.some((u) => Number(row[u]) > 0));
  const hasAnyRevenue = revenueLineData.some((r) => r.receita > 0);

  return (
    <div>
      <Link href="/relatorios" className="text-sm text-brand-700 hover:underline">
        ← Relatórios
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Gráficos — histórico mensal de vendas de reciclados</h1>
      <p className="text-slate-600 text-sm mt-1">
        Saídas de estoque por mês civil no intervalo escolhido. Opcionalmente restrito a um depósito de origem.
        Meses sem movimento aparecem com valor zero. A receita reflete os valores informados nos itens da saída.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 max-w-4xl"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Carregando…' : 'Gerar gráficos'}
        </button>
      </form>

      {data && (
        <div className="mt-8 space-y-8 text-sm">
          <p className="text-slate-600">
            Intervalo:{' '}
            {new Date(data.period.from).toLocaleDateString('pt-BR')} a{' '}
            {new Date(data.period.to).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
            {data.depositId && (
              <span className="block text-slate-500 mt-1">Filtrado por um depósito específico.</span>
            )}
          </p>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-1">Receita mensal (R$)</h2>
            {!hasAnyRevenue ? (
              <p className="text-slate-500 py-8 text-center">Nenhuma receita registrada no período (valores nas saídas).</p>
            ) : (
              <div className="h-[300px] w-full min-h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueLineData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) =>
                        typeof v === 'number'
                          ? v.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
                          : v
                      }
                    />
                    <Tooltip
                      formatter={(value: number) =>
                        value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      }
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="receita"
                      name="Receita"
                      stroke="#059669"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#059669' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-1">Quantidade vendida por mês</h2>
            <p className="text-slate-500 text-xs mb-4">Barras empilhadas por unidade de medida.</p>
            {!hasAnyQty ? (
              <p className="text-slate-500 py-8 text-center">Nenhuma quantidade de saída no período.</p>
            ) : (
              <div className="h-[340px] w-full min-h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={qtyStackData} margin={{ top: 8, right: 8, left: 8, bottom: 56 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={64}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatBrDecimal(value, { minFractionDigits: 2, maxFractionDigits: 2 }),
                        name,
                      ]}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Legend />
                    {unitCodes.map((u, i) => (
                      <Bar
                        key={u}
                        dataKey={u}
                        name={`Un. ${u}`}
                        stackId="qty"
                        fill={UNIT_COLORS[i % UNIT_COLORS.length]}
                        radius={i === unitCodes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
