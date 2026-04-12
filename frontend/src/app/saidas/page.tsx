'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ListRowActions } from '@/components/ListRowActions';
import { PaginationBar } from '@/components/PaginationBar';
import { api, getToken } from '@/lib/api';
import { parseBrDecimal } from '@/lib/br-decimal';
import { formatQty } from '@/lib/format-qty';
import { fetchPaginated } from '@/lib/paginated-api';
import { readUserFullAccess } from '@/lib/access';
import { canEdit } from '@/lib/permissions';
import { PAGE_SIZE } from '@/lib/types';

type ExitRow = {
  id: string;
  exitedAt: string;
  totalValue: string | null;
  notes: string | null;
  center: { id: string; name: string };
  items: {
    quantity: string;
    unitPrice: string | null;
    /** Saldo no depósito de origem antes da saída (persistido na criação). */
    depositBalanceBeforeExit: string | null;
    material: { name: string; code: string | null; unit: { code: string } };
    depositFrom: { id: string; name: string; code: string | null } | null;
  }[];
};

function formatBrl(value: string | null | undefined): string {
  if (value == null || String(value).trim() === '') return '—';
  const n = parseBrDecimal(String(value));
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatExitDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function quantitiesCell(items: ExitRow['items']): string {
  if (items.length === 0) return '—';
  return items
    .map((it) => {
      const u = it.material.unit?.code ?? '';
      return `${formatQty(it.quantity)}${u ? ` ${u}` : ''}`.trim();
    })
    .join(' · ');
}

function unitPricesCell(items: ExitRow['items']): string {
  if (items.length === 0) return '—';
  return items.map((it) => formatBrl(it.unitPrice)).join(' · ');
}

/** Depósito de origem: identificação + quantidade que havia em estoque naquele depósito antes da saída. */
function originDepositCell(items: ExitRow['items']): string {
  if (items.length === 0) return '—';
  return items
    .map((it) => {
      const dep = it.depositFrom
        ? it.depositFrom.code
          ? `${it.depositFrom.code} — ${it.depositFrom.name}`
          : it.depositFrom.name
        : '—';
      const u = it.material.unit?.code ?? '';
      const raw = it.depositBalanceBeforeExit;
      const hasBal = raw != null && String(raw).trim() !== '';
      if (hasBal) {
        const bal = `${formatQty(String(raw))}${u ? ` ${u}` : ''}`;
        return `${dep}: ${bal} em estoque`;
      }
      return dep;
    })
    .join(' · ');
}

export default function SaidasListPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [data, setData] = useState({
    items: [] as ExitRow[],
    total: 0,
    totalPages: 1,
    limit: PAGE_SIZE,
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const canEditHeader = canEdit('saidas');
  const canDelete = readUserFullAccess();

  const load = useCallback(() => {
    if (!getToken()) return;
    setLoading(true);
    setErr('');
    fetchPaginated<ExitRow>('/exits', page, PAGE_SIZE)
      .then((r) =>
        setData({
          items: r.items,
          total: r.total,
          totalPages: r.totalPages,
          limit: r.limit,
        }),
      )
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    load();
  }, [router, load]);

  async function confirmRemove() {
    if (!removeId) return;
    try {
      await api(`/exits/${removeId}`, { method: 'DELETE' });
      setRemoveId(null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
      setRemoveId(null);
    }
  }

  if (!getToken()) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Saídas / destinação</h1>
          <p className="text-slate-600 text-sm mt-1">Listagem paginada</p>
        </div>
        <Link
          href="/saidas/novo"
          className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-brand-700"
        >
          Novo
        </Link>
      </div>
      {err && <p className="text-red-600 text-sm mb-4">{err}</p>}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Centro</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Data da saída</th>
              <th className="px-4 py-3 font-medium">Materiais</th>
              <th className="px-4 py-3 font-medium">Quantidade</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Valor unitário</th>
              <th className="px-4 py-3 font-medium max-w-[14rem]">
                Depósito de origem
                <span className="block font-normal text-slate-500 text-xs mt-0.5">
                  Saldo no depósito antes da saída
                </span>
              </th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Valor total</th>
              <th className="px-4 py-3 font-medium w-36 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : (
              data.items.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{r.center.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                    {formatExitDate(r.exitedAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.items.length === 0
                      ? '—'
                      : r.items.map((it) => it.material.name).join(', ')}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-800">{quantitiesCell(r.items)}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{unitPricesCell(r.items)}</td>
                  <td className="px-4 py-3 text-slate-700 text-xs sm:text-sm">{originDepositCell(r.items)}</td>
                  <td className="px-4 py-3 tabular-nums font-medium text-slate-800">
                    {formatBrl(r.totalValue)}
                  </td>
                  <td className="px-4 py-3">
                    <ListRowActions
                      viewHref={`/saidas/${r.id}`}
                      editHref={`/saidas/${r.id}/editar`}
                      showEdit={canEditHeader}
                      showRemove={canDelete}
                      onRemove={() => setRemoveId(r.id)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <PaginationBar
          page={page}
          totalPages={data.totalPages}
          total={data.total}
          limit={data.limit}
          onPageChange={setPage}
        />
      </div>
      <ConfirmModal
        open={!!removeId}
        title="Excluir saída"
        message="Excluir esta saída e devolver as quantidades ao estoque?"
        onCancel={() => setRemoveId(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
