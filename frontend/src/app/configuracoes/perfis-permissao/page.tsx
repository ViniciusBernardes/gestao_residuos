'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ListRowActions } from '@/components/ListRowActions';
import { PaginationBar } from '@/components/PaginationBar';
import { api, getToken } from '@/lib/api';
import { canEdit, canView } from '@/lib/permissions';
import { fetchPaginated } from '@/lib/paginated-api';
import { readUserFullAccess } from '@/lib/access';
import { PAGE_SIZE } from '@/lib/types';

type Row = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  fullAccess: boolean;
  usersCount: number;
};

export default function PerfisPermissaoListPage() {
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
  const canSee = canView('permissoes');
  const canWrite = canEdit('permissoes');
  const canDelete = readUserFullAccess();

  const load = useCallback(() => {
    if (!getToken()) return;
    setLoading(true);
    setErr('');
    fetchPaginated<Row>('/permission-profiles', page, PAGE_SIZE)
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
    if (!canSee) {
      router.replace('/dashboard');
      return;
    }
    load();
  }, [router, load, canSee]);

  async function confirmRemove() {
    if (!removeId) return;
    setErr('');
    try {
      await api(`/permission-profiles/${removeId}`, { method: 'DELETE' });
      setRemoveId(null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
      setRemoveId(null);
    }
  }

  if (!getToken() || !canSee) return null;

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-brand-700 hover:underline">
        ← Dashboard
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 mt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Perfis de permissão</h1>
          <p className="text-slate-600 text-sm mt-1">
            Defina o que cada usuário pode visualizar e editar no sistema.
          </p>
        </div>
        {canWrite && (
          <Link
            href="/configuracoes/perfis-permissao/novo"
            className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-brand-700"
          >
            Novo perfil
          </Link>
        )}
      </div>

      {err && <p className="text-red-600 text-sm mb-4">{err}</p>}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 font-medium">Usuários</th>
              <th className="px-4 py-3 font-medium">Ativo</th>
              <th className="px-4 py-3 font-medium w-36 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : (
              data.items.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {r.name}
                    {r.fullAccess ? (
                      <span className="ml-2 text-xs font-normal text-amber-700">(acesso total)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.description ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{r.usersCount}</td>
                  <td className="px-4 py-3">{r.active ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-3">
                    <ListRowActions
                      viewHref={`/configuracoes/perfis-permissao/${r.id}/editar`}
                      editHref={`/configuracoes/perfis-permissao/${r.id}/editar`}
                      showView={false}
                      showEdit={canWrite}
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
        title="Excluir perfil"
        message="Excluir este perfil? Só é possível se nenhum usuário estiver vinculado a ele."
        onCancel={() => setRemoveId(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
