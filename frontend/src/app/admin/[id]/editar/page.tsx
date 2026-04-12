'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { CancelToDashboard } from '@/components/CancelToDashboard';
import { api, getToken } from '@/lib/api';
import { canEdit, canView } from '@/lib/permissions';

export default function AdminMunicipioEditarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [err, setErr] = useState('');
  const [slug, setSlug] = useState('');
  const [form, setForm] = useState({
    name: '',
    cnpj: '',
    active: true,
  });
  const canRead = canView('admin');
  const canSave = canEdit('admin');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!canRead) {
      router.replace('/admin');
    }
  }, [router, canRead]);

  useEffect(() => {
    if (!getToken() || !canRead) return;
    api<{ name: string; slug: string; cnpj: string | null; active: boolean }>(`/tenants/${id}`)
      .then((r) => {
        setSlug(r.slug);
        setForm({
          name: r.name,
          cnpj: r.cnpj ?? '',
          active: r.active,
        });
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [id, canRead]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setErr('');
    try {
      await api(`/tenants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          cnpj: form.cnpj.trim(),
          active: form.active,
        }),
      });
      router.push('/admin');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro');
    }
  }

  if (!getToken() || !canRead) return null;

  return (
    <div>
      <Link href="/admin" className="text-sm text-brand-700 hover:underline">
        ← Listagem
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Editar município</h1>
      {err && <p className="text-red-600 text-sm my-4">{err}</p>}
      <form
        onSubmit={submit}
        className="mt-4 max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
      >
        <div>
          <label className="text-xs text-slate-600">Nome</label>
          <input
            required
            disabled={!canSave}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-slate-600">Slug</label>
          <input
            readOnly
            className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-600"
            value={slug}
          />
        </div>
        <div>
          <label className="text-xs text-slate-600">CNPJ</label>
          <input
            disabled={!canSave}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            value={form.cnpj}
            onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            disabled={!canSave}
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Ativo
        </label>
        <div className="flex flex-wrap gap-3 pt-2">
          {canSave ? (
            <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm">
              Salvar
            </button>
          ) : (
            <p className="text-sm text-slate-600">Sem permissão para alterar dados.</p>
          )}
          <CancelToDashboard />
        </div>
      </form>
    </div>
  );
}
