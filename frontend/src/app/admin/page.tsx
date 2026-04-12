'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ListRowActions } from '@/components/ListRowActions';
import { PaginationBar } from '@/components/PaginationBar';
import { readUserFullAccess } from '@/lib/access';
import { api, getToken } from '@/lib/api';
import { fetchPaginated } from '@/lib/paginated-api';
import { canEdit, canView } from '@/lib/permissions';
import { PAGE_SIZE, type Paginated } from '@/lib/types';

type Row = {
  id: string;
  name: string;
  slug: string;
  cnpj: string | null;
  active: boolean;
  createdAt: string;
};

const empty: Paginated<Row> = {
  items: [],
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
  totalPages: 1,
};

export default function AdminMunicipiosPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Row>>(empty);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const canList = canView('admin');
  const canMutate = canEdit('admin');
  const canCreate = readUserFullAccess();

  const load = useCallback(() => {
    if (!getToken() || !canList) return;
    setLoading(true);
    setErr('');
    fetchPaginated<Row>('/tenants', page, PAGE_SIZE)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [page, canList]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!canList) {
      setErr('Sem permissão para ver a administração.');
      setLoading(false);
      return;
    }
    load();
  }, [router, load, canList]);

  if (!getToken()) return null;

  if (!canList) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Administração</h1>
        <p className="text-red-600">{err || 'Sem permissão.'}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Administração</h1>
          <p className="text-slate-600 text-sm mt-1">Município (tenant) — listagem paginada</p>
        </div>
        {canCreate && (
          <Link
            href="/admin/novo"
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
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">CNPJ</th>
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
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.slug}</td>
                  <td className="px-4 py-3 text-slate-600">{r.cnpj ?? '—'}</td>
                  <td className="px-4 py-3">{r.active ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-3">
                    <ListRowActions
                      viewHref={`/admin/${r.id}/editar`}
                      editHref={`/admin/${r.id}/editar`}
                      showView={false}
                      showEdit={canMutate}
                      showRemove={false}
                      onRemove={() => {}}
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
    </div>
  );
}
