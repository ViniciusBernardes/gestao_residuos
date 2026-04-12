'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { readUserFullAccess } from '@/lib/access';
import { api, getToken } from '@/lib/api';
import { CancelToDashboard } from '@/components/CancelToDashboard';
import { fetchItemsForSelect } from '@/lib/paginated-api';

type Prof = { id: string; name: string };

export default function UsuariosNovoPage() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [profiles, setProfiles] = useState<Prof[]>([]);
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    permissionProfileId: '',
  });

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else if (!readUserFullAccess()) router.replace('/usuarios');
  }, [router]);

  useEffect(() => {
    if (!getToken() || !readUserFullAccess()) return;
    fetchItemsForSelect<Prof>('/permission-profiles')
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!form.permissionProfileId) {
      setErr('Selecione um perfil de permissões.');
      return;
    }
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.name,
          permissionProfileId: form.permissionProfileId,
        }),
      });
      router.push('/usuarios');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro');
    }
  }

  if (!getToken() || !readUserFullAccess()) return null;

  return (
    <div>
      <Link href="/usuarios" className="text-sm text-brand-700 hover:underline">
        ← Listagem
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Novo usuário</h1>
      {err && <p className="text-red-600 text-sm my-4">{err}</p>}
      <form
        onSubmit={submit}
        className="mt-4 max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
      >
        <div>
          <label className="text-xs text-slate-600">E-mail</label>
          <input
            required
            type="email"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-slate-600">Senha</label>
          <input
            required
            type="password"
            minLength={6}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
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
        <div>
          <label className="text-xs text-slate-600">Perfil de permissões</label>
          <select
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.permissionProfileId}
            onChange={(e) => setForm({ ...form, permissionProfileId: e.target.value })}
          >
            <option value="">Selecione…</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            O acesso do usuário segue integralmente a matriz (ou o acesso total) deste perfil.
          </p>
        </div>
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
