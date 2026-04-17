'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { CancelToDashboard } from '@/components/CancelToDashboard';
import { readUserFullAccess } from '@/lib/access';
import { api, getToken } from '@/lib/api';

export default function AdminMunicipioNovoPage() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    name: '',
    slug: '',
    cnpj: '',
  });

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else if (!readUserFullAccess()) router.replace('/admin');
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const created = await api<{ id: string }>('/tenants', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim().toLowerCase(),
          cnpj: form.cnpj.trim() || undefined,
        }),
      });
      router.push(`/admin/${created.id}/editar`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro');
    }
  }

  if (!getToken() || !readUserFullAccess()) return null;

  return (
    <div>
      <Link href="/admin" className="text-sm text-brand-700 hover:underline">
        ← Listagem
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Novo município (tenant)</h1>
      <p className="text-slate-600 text-sm mt-1">
        Slug único na plataforma (minúsculas, números e hífens). Após salvar, abre-se a edição para
        enviar o brasão (menu e relatórios). Cadastre usuários e perfis nesse município pelo banco ou
        fluxo de onboarding.
      </p>
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
          <label className="text-xs text-slate-600">Slug</label>
          <input
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Apenas minúsculas, números e hífens"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
            value={form.slug}
            onChange={(e) =>
              setForm({
                ...form,
                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
              })
            }
          />
        </div>
        <div>
          <label className="text-xs text-slate-600">CNPJ (opcional)</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.cnpj}
            onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm">
            Salvar
          </button>
          <CancelToDashboard />
        </div>
      </form>
    </div>
  );
}
