'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, setToken } from '@/lib/api';
import type { PermissionsMatrix } from '@/lib/permission-keys';
import { refreshPermissionsFromMe } from '@/lib/permissions';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@demo.local');
  const [password, setPassword] = useState('Admin@123');
  const [tenantSlug, setTenantSlug] = useState('demo-municipio');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{
        accessToken: string;
        user: {
          name: string;
          email: string;
          tenantId: string;
          fullAccess: boolean;
          permissions?: PermissionsMatrix;
          permissionProfileId?: string | null;
        };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, tenantSlug }),
      });
      setToken(res.accessToken);
      localStorage.setItem('user', JSON.stringify(res.user));
      localStorage.setItem('tenantSlug', tenantSlug);
      await refreshPermissionsFromMe();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-8">
        <h1 className="text-xl font-bold text-slate-800 text-center mb-1">Gestão de Resíduos</h1>
        <p className="text-sm text-slate-500 text-center mb-6">Acesso ao município (tenant)</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Slug do município</label>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">E-mail</label>
            <input
              type="email"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Senha</label>
            <input
              type="password"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 text-white py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="text-xs text-slate-500 mt-4 text-center">
          Use <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px]">Tab</kbd> para
          navegar entre os campos. Após entrar, pressione{' '}
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px]">?</kbd> para ver
          atalhos de teclado.
        </p>
        <p className="text-xs text-slate-400 mt-2 text-center">PoC — JWT + RBAC + LGPD (logs)</p>
      </div>
    </div>
  );
}
