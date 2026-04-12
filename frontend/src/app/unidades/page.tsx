'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ListRowActions } from '@/components/ListRowActions';
import { PaginationBar } from '@/components/PaginationBar';
import { api, getToken } from '@/lib/api';
import { fetchPaginated } from '@/lib/paginated-api';
import { readUserFullAccess } from '@/lib/access';
import { canEdit } from '@/lib/permissions';
import { PAGE_SIZE } from '@/lib/types';

type Row = { id: string; code: string; name: string; active: boolean };

export default function UnidadesListPage() {
  const router = useRouter();
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
  const canMutate = canEdit('config_unidades');
  const canDelete = readUserFullAccess();

  const load = useCallback(() => {
    if (!getToken()) return;
    setLoading(true);
    setErr('');
    fetchPaginated<Row>('/units', page, PAGE_SIZE)
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
      await api(`/units/${removeId}`, { method: 'DELETE' });
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
          <h1 className="text-2xl font-bold text-slate-800">Unidades de medida</h1>
          <p className="text-slate-600 text-sm mt-1">Listagem paginada</p>
        </div>
        {canMutate && (
          <Link
            href="/unidades/novo"
            className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-brand-700"
          >
            Novo
          </Link>
        )}
      </div>
      {err && <p className="text-red-600 text-sm mb-4">{err}</p>}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Ativo</th>
              <th className="px-4 py-3 font-medium w-36 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : (
              data.items.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono">{r.code}</td>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.active ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-3">
                    <ListRowActions
                      viewHref={`/unidades/${r.id}`}
                      editHref={`/unidades/${r.id}/editar`}
                      showEdit={canMutate}
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
        title="Remover unidade"
        message="Deseja desativar esta unidade de medida?"
        confirmLabel="Remover"
        onCancel={() => setRemoveId(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
