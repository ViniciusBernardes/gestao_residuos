'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, getToken } from '@/lib/api';
import { parseBrDecimal } from '@/lib/br-decimal';
import { formatQty } from '@/lib/format-qty';

type RevenueMonth = {
  month: string;
  monthLabel: string;
  revenueTotal: string;
};

type Dashboard = {
  totalStockQuantity: string;
  revenueTotal: string;
  activeDeposits: number;
  activeMaterials: number;
  /** Série mensal alinhada ao relatório «Histórico mensal de vendas» (receita por item de saída). */
  revenueByMonth?: RevenueMonth[];
};

function moneyNum(s: string): number {
  const n = parseBrDecimal(s);
  return Number.isFinite(n) ? n : 0;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api<Dashboard>('/reports/dashboard')
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [router]);

  const chartData = useMemo(() => {
    const months = data?.revenueByMonth;
    if (!months?.length) return [];
    return months.map((r) => ({
      name: r.monthLabel,
      receita: moneyNum(r.revenueTotal),
    }));
  }, [data]);

  const hasMonthlyRevenue = useMemo(() => chartData.some((r) => r.receita > 0), [chartData]);

  if (!getToken()) return null;

  const revenueCard = data
    ? moneyNum(data.revenueTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '';

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Dashboard</h1>
      <p className="text-slate-600 text-sm mb-6">Visão consolidada do município</p>
      {err && <p className="text-red-600 text-sm mb-4">{err}</p>}
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-slate-500 uppercase">Quantidade em estoque</div>
              <div className="text-2xl font-semibold text-brand-800 mt-1 tabular-nums">
                {formatQty(data.totalStockQuantity || '0')}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-slate-500 uppercase">Receita (saídas)</div>
              <div className="text-2xl font-semibold text-emerald-700 mt-1 tabular-nums">{revenueCard}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-slate-500 uppercase">Depósitos ativos</div>
              <div className="text-2xl font-semibold text-slate-800 mt-1">{data.activeDeposits}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-slate-500 uppercase">Materiais ativos</div>
              <div className="text-2xl font-semibold text-slate-800 mt-1">{data.activeMaterials}</div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
              <h2 className="text-lg font-bold text-slate-800">Receita mensal (R$)</h2>
              <Link
                href="/relatorios/vendas-historico-mensal"
                className="text-sm text-brand-700 hover:underline shrink-0"
              >
                Histórico mensal de vendas
              </Link>
            </div>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              Mesma base do relatório de vendas de reciclados: saídas (EXIT) de 1º de janeiro até o último dia do mês
              atual, todos os depósitos; receita somada a partir dos valores informados nos itens de cada saída. Meses
              sem movimento aparecem em zero.
            </p>
            {chartData.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                Ainda não há dados de receita mensal para o período.
              </p>
            ) : !hasMonthlyRevenue ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                Nenhuma receita registrada no ano (valores nos itens das saídas de reciclados).
              </p>
            ) : (
              <div className="h-[320px] w-full min-h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#64748b' }}
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
                      name="Receita mensal"
                      stroke="#059669"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#059669' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
