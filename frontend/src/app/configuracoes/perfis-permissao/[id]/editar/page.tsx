'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { CancelToDashboard } from '@/components/CancelToDashboard';
import { canEdit, canView } from '@/lib/permissions';
import type { PermissionsMatrix } from '@/lib/permission-keys';

type Def = { key: string; label: string };

export default function PerfisPermissaoEditarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [err, setErr] = useState('');
  const [defs, setDefs] = useState<Def[]>([]);
  const [matrix, setMatrix] = useState<PermissionsMatrix>({});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!canView('permissoes')) {
      router.replace('/dashboard');
      return;
    }
    let cancelled = false;
    Promise.all([
      api<Def[]>('/permission-profiles/definitions'),
      api<{
        name: string;
        description: string | null;
        active: boolean;
        permissions: PermissionsMatrix;
      }>(`/permission-profiles/${id}`),
    ])
      .then(([d, row]) => {
        if (cancelled) return;
        setDefs(d);
        setName(row.name);
        setDescription(row.description ?? '');
        setActive(row.active);
        const merged: PermissionsMatrix = { ...row.permissions };
        for (const x of d) {
          if (!merged[x.key]) merged[x.key] = { view: false, edit: false };
        }
        setMatrix(merged);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Erro');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  function setCell(key: string, field: 'view' | 'edit', value: boolean) {
    setMatrix((prev) => {
      const cur = { ...(prev[key] ?? { view: false, edit: false }) };
      if (field === 'view') {
        cur.view = value;
        if (!value) cur.edit = false;
      } else {
        cur.edit = value;
        if (value) cur.view = true;
      }
      return { ...prev, [key]: cur };
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!canEdit('permissoes')) return;
    if (!name.trim()) {
      setErr('Informe o nome do perfil.');
      return;
    }
    try {
      await api(`/permission-profiles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: matrix,
          active,
        }),
      });
      router.push('/configuracoes/perfis-permissao');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro');
    }
  }

  if (!getToken() || !canView('permissoes')) return null;

  return (
    <div>
      <Link href="/configuracoes/perfis-permissao" className="text-sm text-brand-700 hover:underline">
        ← Listagem
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Editar perfil de permissão</h1>
      {err && <p className="text-red-600 text-sm my-4">{err}</p>}
      {loading ? (
        <p className="text-slate-600 text-sm mt-4">Carregando…</p>
      ) : (
        <form
          onSubmit={submit}
          className="mt-4 max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs text-slate-600">Nome do perfil</label>
              <input
                required
                disabled={!canEdit('permissoes')}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-600">Descrição (opcional)</label>
              <input
                disabled={!canEdit('permissoes')}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                disabled={!canEdit('permissoes')}
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Perfil ativo
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Módulo</th>
                  <th className="px-3 py-2 font-medium text-center w-28">Visualizar</th>
                  <th className="px-3 py-2 font-medium text-center w-28">Editar</th>
                </tr>
              </thead>
              <tbody>
                {defs.map((d) => (
                  <tr key={d.key} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{d.label}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        disabled={!canEdit('permissoes')}
                        checked={!!matrix[d.key]?.view}
                        onChange={(e) => setCell(d.key, 'view', e.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        disabled={!canEdit('permissoes')}
                        checked={!!matrix[d.key]?.edit}
                        onChange={(e) => setCell(d.key, 'edit', e.target.checked)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canEdit('permissoes') && (
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="rounded-lg bg-brand-600 text-white py-2.5 px-4 text-sm font-medium">
                Salvar alterações
              </button>
              <CancelToDashboard />
            </div>
          )}
        </form>
      )}
    </div>
  );
}
