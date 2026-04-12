'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { canEdit } from '@/lib/permissions';

type Row = { id: string; code: string; name: string; active: boolean; createdAt: string };

export default function UnidadesVerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api<Row>(`/units/${id}`)
      .then(setRow)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [id, router]);

  if (!getToken()) return null;

  const canMutate = canEdit('config_unidades');

  return (
    <div>
      <Link href="/unidades" className="text-sm text-brand-700 hover:underline">
        ← Listagem
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Unidade</h1>
      {err && <p className="text-red-600 text-sm mt-4">{err}</p>}
      {row && (
        <div className="mt-6 max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 text-sm">
          <p>
            <span className="text-slate-500">Código</span>
            <br />
            <span className="font-mono font-medium">{row.code}</span>
          </p>
          <p>
            <span className="text-slate-500">Nome</span>
            <br />
            <span className="font-medium">{row.name}</span>
          </p>
          <p>
            <span className="text-slate-500">Ativo</span>
            <br />
            {row.active ? 'Sim' : 'Não'}
          </p>
          {canMutate && (
            <Link href={`/unidades/${id}/editar`} className="inline-block text-brand-700 font-medium pt-2">
              Editar
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
