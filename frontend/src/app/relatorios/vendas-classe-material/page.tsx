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
import { canView } from '@/lib/permissions';

type QtyRow = { unitCode: string; quantity: string };

type ClassRow = {
  materialTypeId: string;
  materialTypeName: string;
  revenueTotal: string;
  quantities: QtyRow[];
};

type MonthRow = {
  month: string;
  monthLabel: string;
  revenueTotal: string;
  quantities: QtyRow[];
};

type ChartPayload = {
  period: { from: string; to: string };
  byMaterialClass: ClassRow[];
  byMonth: MonthRow[];
};

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function qtyNum(s: string): number {
  const n = parseBrDecimal(s);
  return Number.isFinite(n) ? n : 0;
}

function moneyNum(s: string): number {
  const n = parseBrDecimal(s);
  return Number.isFinite(n) ? n : 0;
}

const UNIT_COLORS = ['#0d9488', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#4d7c0f', '#b45309'];

export default function RelatorioVendasClasseMaterialPage() {
  const router = useRouter();
  const [materialTypes, setMaterialTypes] = useState<{ id: string; name: string }[]>([]);
  const [materials, setMaterials] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [deposits, setDeposits] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChartPayload | null>(null);

  const today = new Date();
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [materialTypeId, setMaterialTypeId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [dateFrom, setDateFrom] = useState(localYmd(startMonth));
  const [dateTo, setDateTo] = useState(localYmd(today));
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
    Promise.all([
      fetchItemsForSelect<{ id: string; name: string }>('/material-types'),
      fetchItemsForSelect<{ id: string; name: string; code: string | null }>('/materials'),
      fetchItemsForSelect<{ id: string; tradeName: string; code: string | null }>(
        '/establishments?role=DEPOSIT',
      ).then((rows) => rows.map((r) => ({ id: r.id, name: r.tradeName, code: r.code }))),
    ])
      .then(([mt, mat, dep]) => {
        setMaterialTypes(mt);
        setMaterials(mat);
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
      const q = new URLSearchParams({ dateFrom, dateTo });
      if (materialTypeId) q.set('materialTypeId', materialTypeId);
      if (materialId) q.set('materialId', materialId);
      if (depositId) q.set('depositId', depositId);
      const res = await api<ChartPayload>(`/reports/sales-by-material-class-chart?${q.toString()}`);
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, materialTypeId, materialId, depositId]);

  const unitCodesForClass = useMemo(() => {
    if (!data?.byMaterialClass.length) return [] as string[];
    const s = new Set<string>();
    for (const r of data.byMaterialClass) {
      for (const q of r.quantities) s.add(q.unitCode);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [data]);

  const qtyStackData = useMemo(() => {
    if (!data?.byMaterialClass.length) return [];
    return data.byMaterialClass.map((r) => {
      const row: Record<string, string | number> = { name: r.materialTypeName };
      for (const u of unitCodesForClass) {
        const found = r.quantities.find((x) => x.unitCode === u);
        row[u] = found ? qtyNum(found.quantity) : 0;
      }
      return row;
    });
  }, [data, unitCodesForClass]);

  const revenueBarData = useMemo(() => {
    if (!data?.byMaterialClass.length) return [];
    return data.byMaterialClass.map((r) => ({
      name: r.materialTypeName,
      receita: moneyNum(r.revenueTotal),
    }));
  }, [data]);

  const monthLineData = useMemo(() => {
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

  return (
    <div>
      <Link href="/relatorios" className="text-sm text-brand-700 hover:underline">
        ← Relatórios
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Gráficos — vendas por classe de material</h1>
      <p className="text-slate-600 text-sm mt-1">
        Resultados das saídas (vendas) no período, por tipo de material. Quantidades somam movimentos de saída; receita
        vem dos valores informados nos itens da saída, quando houver.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 max-w-4xl"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
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
            <label className="text-xs text-slate-600">Material</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
            >
              <option value="">Todos</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code ? `${m.code} — ${m.name}` : m.name}
                </option>
              ))}
            </select>
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
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Carregando…' : 'Atualizar gráficos'}
        </button>
      </form>

      {data && (
        <div className="mt-8 space-y-8 text-sm">
          <p className="text-slate-600">
            Período:{' '}
            {new Date(data.period.from).toLocaleDateString('pt-BR')} a{' '}
            {new Date(data.period.to).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </p>

          {data.byMaterialClass.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
              Nenhuma saída no período com os filtros selecionados.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800 mb-1">Quantidade vendida por classe</h2>
                <p className="text-slate-500 text-xs mb-4">
                  Barras empilhadas por unidade de medida, quando houver mais de uma no conjunto.
                </p>
                <div className="h-[340px] w-full min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={qtyStackData} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          formatBrDecimal(value, { minFractionDigits: 2, maxFractionDigits: 2 }),
                          name,
                        ]}
                        labelFormatter={(label) => String(label)}
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                      />
                      <Legend />
                      {unitCodesForClass.map((u, i) => (
                        <Bar
                          key={u}
                          dataKey={u}
                          name={`Un. ${u}`}
                          stackId="qty"
                          fill={UNIT_COLORS[i % UNIT_COLORS.length]}
                          radius={i === unitCodesForClass.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800 mb-1">Receita por classe (R$)</h2>
                <p className="text-slate-500 text-xs mb-4">Soma do valor dos itens nas saídas vinculadas.</p>
                <div className="h-[320px] w-full min-h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueBarData} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={70}
                      />
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
                      <Bar dataKey="receita" name="Receita" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {monthLineData.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-800 mb-1">Receita no tempo (por mês)</h2>
                  <p className="text-slate-500 text-xs mb-4">Mesma base de filtros, agrupada por mês civil.</p>
                  <div className="h-[300px] w-full min-h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthLineData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
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
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
