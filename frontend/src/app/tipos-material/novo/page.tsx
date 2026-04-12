'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { CancelToDashboard } from '@/components/CancelToDashboard';
import { canEdit } from '@/lib/permissions';

export default function TiposMaterialNovoPage() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ name: '', description: '', active: true });

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else if (!canEdit('config_tipos_material')) router.replace('/tipos-material');
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api('/material-types', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          active: form.active,
        }),
      });
      router.push('/tipos-material');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro');
    }
  }

  if (!getToken() || !canEdit('config_tipos_material')) return null;

  return (
    <div>
      <div className="mb-6">
        <Link href="/tipos-material" className="text-sm text-brand-700 hover:underline">
          ← Voltar à listagem
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 mt-2">Novo tipo de material</h1>
      </div>
      {err && <p className="text-red-600 text-sm mb-4">{err}</p>}
      <form
        onSubmit={submit}
        className="max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
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
          <label className="text-xs text-slate-600">Descrição</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
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
