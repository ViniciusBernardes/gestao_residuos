'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { CancelToDashboard } from '@/components/CancelToDashboard';
import { canEdit, canView } from '@/lib/permissions';
import type { PermissionsMatrix } from '@/lib/permission-keys';

type Def = { key: string; label: string };

export default function PerfisPermissaoNovoPage() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [defs, setDefs] = useState<Def[]>([]);
  const [matrix, setMatrix] = useState<PermissionsMatrix>({});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!canView('permissoes') || !canEdit('permissoes')) {
      router.replace('/configuracoes/perfis-permissao');
      return;
    }
    api<Def[]>('/permission-profiles/definitions')
      .then((d) => {
        setDefs(d);
        const init: PermissionsMatrix = {};
        for (const x of d) init[x.key] = { view: false, edit: false };
        setMatrix(init);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [router]);

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
    if (!name.trim()) {
      setErr('Informe o nome do perfil.');
      return;
    }
    try {
      await api('/permission-profiles', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: matrix,
        }),
      });
      router.push('/configuracoes/perfis-permissao');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro');
    }
  }

  if (!getToken()) return null;
  if (!canView('permissoes') || !canEdit('permissoes')) return null;

  return (
    <div>
      <Link href="/configuracoes/perfis-permissao" className="text-sm text-brand-700 hover:underline">
        ← Listagem
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Novo perfil de permissão</h1>
      <p className="text-slate-600 text-sm mt-1 max-w-2xl">
        Marque <strong>Visualizar</strong> para permitir acesso ao menu e consultas. Marque{' '}
        <strong>Editar</strong> para permitir criar, alterar e excluir registros do módulo (conforme o
        papel do usuário no sistema).
      </p>
      {err && <p className="text-red-600 text-sm my-4">{err}</p>}
      <form
        onSubmit={submit}
        className="mt-4 max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs text-slate-600">Nome do perfil</label>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-600">Descrição (opcional)</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
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
                      checked={!!matrix[d.key]?.view}
                      onChange={(e) => setCell(d.key, 'view', e.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!matrix[d.key]?.edit}
                      onChange={(e) => setCell(d.key, 'edit', e.target.checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="rounded-lg bg-brand-600 text-white py-2.5 px-4 text-sm font-medium">
            Salvar perfil
          </button>
          <CancelToDashboard />
        </div>
      </form>
    </div>
  );
}
