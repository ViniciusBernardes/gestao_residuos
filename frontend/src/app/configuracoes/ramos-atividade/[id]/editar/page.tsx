'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { CancelToDashboard } from '@/components/CancelToDashboard';
import { canEdit } from '@/lib/permissions';

type EstRole = 'DEPOSIT' | 'DESTINATION';

export default function RamosAtividadeEditarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    name: '',
    role: 'DEPOSIT' as EstRole,
    active: true,
  });

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!canEdit('config_ramos')) {
      router.replace('/configuracoes/ramos-atividade');
      return;
    }
    api<{ name: string; role: EstRole; active: boolean }>(`/activity-branches/${id}`)
      .then((r) =>
        setForm({
          name: r.name,
          role: r.role,
          active: r.active,
        }),
      )
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [id, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api(`/activity-branches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          role: form.role,
          active: form.active,
        }),
      });
      router.push(`/configuracoes/ramos-atividade/${id}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro');
    }
  }

  if (!getToken() || !canEdit('config_ramos')) return null;

  return (
    <div>
      <Link
        href={`/configuracoes/ramos-atividade/${id}`}
        className="text-sm text-brand-700 hover:underline"
      >
        ← Visualizar
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Editar ramo</h1>
      {err && <p className="text-red-600 text-sm my-4">{err}</p>}
      <form
        onSubmit={submit}
        className="mt-4 max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
      >
        <div>
          <label className="text-xs text-slate-600">Nome</label>
          <input
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-slate-600">Papel no sistema</label>
          <select
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as EstRole })}
          >
            <option value="DEPOSIT">Depósito</option>
            <option value="DESTINATION">Destino final</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Ativo
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm">
            Salvar
          </button>
          <CancelToDashboard />
        </div>
      </form>
    </div>
  );
}
