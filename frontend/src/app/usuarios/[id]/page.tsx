'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { readUserFullAccess } from '@/lib/access';
import { api, getToken } from '@/lib/api';
import { canView } from '@/lib/permissions';

type Row = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  fullAccess: boolean;
  permissionProfile: { id: string; name: string; fullAccess: boolean } | null;
};

export default function UsuariosVerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);
  const [err, setErr] = useState('');
  const canList = canView('usuarios');
  const canManageUsers = readUserFullAccess();

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!canList) {
      setErr('Sem permissão.');
      return;
    }
    api<Row>(`/users/${id}`)
      .then(setRow)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [id, router, canList]);

  if (!getToken()) return null;

  if (!canList) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Usuário</h1>
        <p className="text-red-600 mt-4">{err}</p>
      </div>
    );
  }

  return (
    <div>
      <Link href="/usuarios" className="text-sm text-brand-700 hover:underline">
        ← Listagem
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Usuário</h1>
      {err && <p className="text-red-600 text-sm mt-4">{err}</p>}
      {row && (
        <div className="mt-6 max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 text-sm">
          <p>
            <span className="text-slate-500">Nome</span>
            <br />
            <span className="font-medium">{row.name}</span>
          </p>
          <p>
            <span className="text-slate-500">E-mail</span>
            <br />
            {row.email}
          </p>
          <p>
            <span className="text-slate-500">Perfil de permissões</span>
            <br />
            {row.permissionProfile
              ? `${row.permissionProfile.name}${row.permissionProfile.fullAccess ? ' (acesso total)' : ''}`
              : '—'}
          </p>
          <p>
            <span className="text-slate-500">Ativo</span>
            <br />
            {row.active ? 'Sim' : 'Não'}
          </p>
          {canManageUsers && (
            <Link href={`/usuarios/${id}/editar`} className="inline-block text-brand-700 font-medium pt-2">
              Editar
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
