'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { canEdit } from '@/lib/permissions';

type EstRole = 'DEPOSIT' | 'DESTINATION';

type Row = { id: string; name: string; role: EstRole; active: boolean };

function roleLabel(r: EstRole) {
  return r === 'DEPOSIT' ? 'Depósito' : 'Destino final';
}

export default function RamosAtividadeDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api<Row>(`/activity-branches/${id}`)
      .then(setRow)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [id, router]);

  if (!getToken()) return null;
  const canMutate = canEdit('config_ramos');

  if (err && !row) return <p className="text-red-600 text-sm">{err}</p>;
  if (!row) return <p className="text-slate-600 text-sm">Carregando…</p>;

  return (
    <div>
      <Link
        href="/configuracoes/ramos-atividade"
        className="text-sm text-brand-700 hover:underline"
      >
        ← Listagem
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">{row.name}</h1>
      <dl className="mt-6 space-y-2 text-sm">
        <div>
          <dt className="text-slate-500">Papel</dt>
          <dd className="font-medium">{roleLabel(row.role)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Ativo</dt>
          <dd className="font-medium">{row.active ? 'Sim' : 'Não'}</dd>
        </div>
      </dl>
      {canMutate && (
        <Link
          href={`/configuracoes/ramos-atividade/${id}/editar`}
          className="inline-block mt-6 text-brand-700 font-medium"
        >
          Editar
        </Link>
      )}
    </div>
  );
}
