'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ListRowActions } from '@/components/ListRowActions';
import { PaginationBar } from '@/components/PaginationBar';
import { api, getToken } from '@/lib/api';
import { formatCnpj } from '@/lib/masks';
import { fetchPaginated } from '@/lib/paginated-api';
import { canEdit } from '@/lib/permissions';
import { PAGE_SIZE } from '@/lib/types';

type EstRole = 'DEPOSIT' | 'DESTINATION';

type Row = {
  id: string;
  tradeName: string;
  legalName: string;
  cnpj: string | null;
  code: string | null;
  role: EstRole;
  active: boolean;
  activityBranch: { name: string };
};

function EstabelecimentosListInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const tab = (sp.get('role') === 'DESTINATION' ? 'DESTINATION' : 'DEPOSIT') as EstRole;

  const [page, setPage] = useState(1);
  const [data, setData] = useState({
    items: [] as Row[],
    total: 0,
    totalPages: 1,
    limit: PAGE_SIZE,
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const canMutate = canEdit('estabelecimentos');

  const setTab = useCallback(
    (r: EstRole) => {
      setPage(1);
      router.replace(`/estabelecimentos?role=${r}`);
    },
    [router],
  );

  const load = useCallback(() => {
    if (!getToken()) return;
    setLoading(true);
    setErr('');
    fetchPaginated<Row>(`/establishments?role=${tab}`, page, PAGE_SIZE)
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
  }, [page, tab]);

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
      await api(`/establishments/${removeId}`, { method: 'DELETE' });
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
          <h1 className="text-2xl font-bold text-slate-800">Estabelecimentos</h1>
          <p className="text-slate-600 text-sm mt-1">
            Depósitos e destinos finais no mesmo cadastro, separados por tipo e ramo de atividade.
          </p>
        </div>
        {canMutate && (
          <Link
            href={`/estabelecimentos/novo?role=${tab}`}
            className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-brand-700"
          >
            Novo
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-4 border-b border-slate-200">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'DEPOSIT'
              ? 'border-brand-600 text-brand-800'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
          onClick={() => setTab('DEPOSIT')}
        >
          Depósitos
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'DESTINATION'
              ? 'border-brand-600 text-brand-800'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
          onClick={() => setTab('DESTINATION')}
        >
          Destino final
        </button>
      </div>

      {err && <p className="text-red-600 text-sm mb-4">{err}</p>}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nome comercial</th>
              <th className="px-4 py-3 font-medium">Ramo</th>
              <th className="px-4 py-3 font-medium">CNPJ</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Ativo</th>
              <th className="px-4 py-3 font-medium w-36 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : (
              data.items.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{r.tradeName}</td>
                  <td className="px-4 py-3">{r.activityBranch.name}</td>
                  <td className="px-4 py-3">{r.cnpj ? formatCnpj(r.cnpj) : '—'}</td>
                  <td className="px-4 py-3">{r.code ?? '—'}</td>
                  <td className="px-4 py-3">{r.active ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-3">
                    <ListRowActions
                      viewHref={`/estabelecimentos/${r.id}?role=${r.role}`}
                      editHref={`/estabelecimentos/${r.id}/editar?role=${r.role}`}
                      showEdit={canMutate}
                      showRemove={canMutate}
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
        title="Desativar estabelecimento"
        message="Deseja desativar este registro?"
        onCancel={() => setRemoveId(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

export default function EstabelecimentosPage() {
  return (
    <Suspense fallback={<p className="text-slate-600 text-sm">Carregando…</p>}>
      <EstabelecimentosListInner />
    </Suspense>
  );
}
