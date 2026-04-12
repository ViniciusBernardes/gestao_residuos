'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { CancelToDashboard } from '@/components/CancelToDashboard';
import { canEdit } from '@/lib/permissions';

export default function UnidadesEditarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ code: '', name: '', active: true });

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!canEdit('config_unidades')) {
      router.replace('/unidades');
      return;
    }
    api<{ code: string; name: string; active: boolean }>(`/units/${id}`)
      .then((r) => setForm({ code: r.code, name: r.name, active: r.active }))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [id, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api(`/units/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      router.push(`/unidades/${id}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro');
    }
  }

  if (!getToken() || !canEdit('config_unidades')) return null;

  return (
    <div>
      <Link href={`/unidades/${id}`} className="text-sm text-brand-700 hover:underline">
        ← Visualizar
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Editar unidade</h1>
      {err && <p className="text-red-600 text-sm my-4">{err}</p>}
      <form
        onSubmit={submit}
        className="mt-4 max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
      >
        <div>
          <label className="text-xs text-slate-600">Código</label>
          <input
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm uppercase"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-slate-600">Nome</label>
          <input
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
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
