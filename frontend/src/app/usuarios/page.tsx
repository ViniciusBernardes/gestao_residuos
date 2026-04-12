'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ListRowActions } from '@/components/ListRowActions';
import { PaginationBar } from '@/components/PaginationBar';
import { readUserFullAccess } from '@/lib/access';
import { api, getToken } from '@/lib/api';
import { fetchPaginated } from '@/lib/paginated-api';
import { canView } from '@/lib/permissions';
import { PAGE_SIZE } from '@/lib/types';

type Row = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  permissionProfile: { id: string; name: string; fullAccess: boolean } | null;
};

export default function UsuariosListPage() {
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
  const canList = canView('usuarios');
  const canManageUsers = readUserFullAccess();

  const load = useCallback(() => {
    if (!getToken() || !canList) return;
    setLoading(true);
    setErr('');
    fetchPaginated<Row>('/users', page, PAGE_SIZE)
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
  }, [page, canList]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!canList) {
      setErr('Sem permissão para ver a lista de usuários.');
      setLoading(false);
      return;
    }
    load();
  }, [router, load, canList]);

  async function confirmRemove() {
    if (!removeId || !canManageUsers) return;
    try {
      await api(`/users/${removeId}`, { method: 'DELETE' });
      setRemoveId(null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
      setRemoveId(null);
    }
  }

  if (!getToken()) return null;

  if (!canList) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Usuários</h1>
        <p className="text-red-600">{err || 'Sem permissão.'}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuários</h1>
          <p className="text-slate-600 text-sm mt-1">Listagem paginada</p>
        </div>
        {canManageUsers && (
          <Link
            href="/usuarios/novo"
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
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Perfil de permissões</th>
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
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.permissionProfile
                      ? `${r.permissionProfile.name}${r.permissionProfile.fullAccess ? ' (acesso total)' : ''}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">{r.active ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-3">
                    <ListRowActions
                      viewHref={`/usuarios/${r.id}`}
                      editHref={`/usuarios/${r.id}/editar`}
                      showEdit={canManageUsers}
                      showRemove={canManageUsers}
                      onRemove={() => setRemoveId(r.id)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <PaginationBar
        page={page}
        totalPages={data.totalPages}
        total={data.total}
        limit={data.limit}
        onPageChange={setPage}
      />
      <ConfirmModal
        open={removeId !== null}
        title="Desativar usuário"
        message="Confirma desativar este usuário?"
        onCancel={() => setRemoveId(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
