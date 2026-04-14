'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { API_BASE, apiBlob, getToken } from '@/lib/api';

export default function RelatoriosPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  if (!getToken()) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Relatórios</h1>
      <p className="text-slate-600 text-sm mb-6">
        Exportações em PDF e Excel (autenticadas via token na sessão)
      </p>
      <p className="text-sm mb-4">
        <Link href="/relatorios/analitico-geral" className="text-brand-700 font-medium hover:underline">
          Relatório analítico geral
        </Link>
        <span className="text-slate-600"> — tipo de material, período, depósito (opcional) e ordenação.</span>
      </p>
      <p className="text-sm mb-4">
        <Link href="/relatorios/analitico-por-deposito" className="text-brand-700 font-medium hover:underline">
          Relatório analítico por depósito
        </Link>
        <span className="text-slate-600">
          {' '}
          — tipo de material, período, depósito obrigatório e ordenação por código ou descrição.
        </span>
      </p>
      <p className="text-sm mb-6">
        <Link href="/relatorios/estoque-geral" className="text-brand-700 font-medium hover:underline">
          Materiais em estoque geral
        </Link>
        <span className="text-slate-600">
          {' '}
          — saldo por depósito até a data final; filtros por tipo de material, período, depósito e ordenação.
        </span>
      </p>
      <p className="text-sm mb-6">
        <Link href="/relatorios/vendas-classe-material" className="text-brand-700 font-medium hover:underline">
          Gráficos — vendas por classe de material
        </Link>
        <span className="text-slate-600">
          {' '}
          — tipo de material, material, depósito e período; quantidades e receita por classe e evolução mensal.
        </span>
      </p>
      <p className="text-sm mb-6">
        <Link href="/relatorios/vendas-historico-mensal" className="text-brand-700 font-medium hover:underline">
          Gráficos — histórico mensal de vendas de reciclados
        </Link>
        <span className="text-slate-600"> — depósito (opcional), período inicial e final; série mensal de receita e quantidades.</span>
      </p>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 max-w-lg">
        <p className="text-sm text-slate-700">
          Os downloads usam o mesmo JWT do painel. Em produção, prefira URLs assinadas ou
          streaming pelo backend.
        </p>
        <div className="flex flex-col gap-2">
          <a
            className="inline-flex justify-center rounded-lg bg-slate-800 text-white py-2.5 text-sm hover:bg-slate-700"
            href={`${API_BASE}/reports/export/stock.pdf`}
            onClick={(e) => {
              e.preventDefault();
              void apiBlob('/reports/export/stock.pdf')
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'estoque.pdf';
                  a.click();
                  URL.revokeObjectURL(url);
                })
                .catch(() => {});
            }}
          >
            Baixar estoque (PDF)
          </a>
          <a
            className="inline-flex justify-center rounded-lg border border-slate-300 py-2.5 text-sm hover:bg-slate-50"
            href={`${API_BASE}/reports/export/movements.xlsx`}
            onClick={(e) => {
              e.preventDefault();
              void apiBlob('/reports/export/movements.xlsx')
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'movimentacoes.xlsx';
                  a.click();
                  URL.revokeObjectURL(url);
                })
                .catch(() => {});
            }}
          >
            Baixar movimentações (Excel)
          </a>
        </div>
      </div>
    </div>
  );
}
