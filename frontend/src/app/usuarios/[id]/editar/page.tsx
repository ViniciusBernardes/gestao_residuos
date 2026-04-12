'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { readUserFullAccess } from '@/lib/access';
import { api, getToken } from '@/lib/api';
import { CancelToDashboard } from '@/components/CancelToDashboard';
import { fetchItemsForSelect } from '@/lib/paginated-api';

type Prof = { id: string; name: string };

export default function UsuariosEditarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [err, setErr] = useState('');
  const [email, setEmail] = useState('');
  const [profiles, setProfiles] = useState<Prof[]>([]);
  const [form, setForm] = useState({
    password: '',
    name: '',
    active: true,
    permissionProfileId: '' as string,
  });

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!readUserFullAccess()) {
      router.replace('/usuarios');
      return;
    }
    fetchItemsForSelect<Prof>('/permission-profiles')
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, [router]);

  useEffect(() => {
    if (!getToken() || !readUserFullAccess()) return;
    api<{
      email: string;
      name: string;
      active: boolean;
      permissionProfileId: string;
    }>(`/users/${id}`)
      .then((r) => {
        setEmail(r.email);
        setForm({
          password: '',
          name: r.name,
          active: r.active,
          permissionProfileId: r.permissionProfileId,
        });
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!form.permissionProfileId) {
      setErr('Selecione um perfil de permissões.');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        active: form.active,
        permissionProfileId: form.permissionProfileId,
      };
      if (form.password.trim()) body.password = form.password;
      await api(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      router.push(`/usuarios/${id}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro');
    }
  }

  if (!getToken() || !readUserFullAccess()) return null;

  return (
    <div>
      <Link href={`/usuarios/${id}`} className="text-sm text-brand-700 hover:underline">
        ← Visualizar
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Editar usuário</h1>
      {err && <p className="text-red-600 text-sm my-4">{err}</p>}
      <form
        onSubmit={submit}
        className="mt-4 max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
      >
        <div>
          <label className="text-xs text-slate-600">E-mail</label>
          <input
            type="email"
            readOnly
            aria-readonly="true"
            className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 cursor-default focus:ring-0 focus:border-slate-200"
            value={email}
            autoComplete="off"
          />
          <p className="text-xs text-slate-500 mt-1">O e-mail não pode ser alterado.</p>
        </div>
        <div>
          <label className="text-xs text-slate-600">Senha (deixe em branco para não alterar)</label>
          <input
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
