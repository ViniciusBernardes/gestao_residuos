'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { canEdit } from '@/lib/permissions';

type Row = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  materialType: { id: string; name: string };
  unit: { id: string; code: string; name: string };
};

export default function MateriaisVerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);
  const [err, setErr] = useState('');
  const canMutate = canEdit('materiais');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api<Row>(`/materials/${id}`)
      .then(setRow)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [id, router]);

  if (!getToken()) return null;

  return (
    <div>
      <Link href="/materiais" className="text-sm text-brand-700 hover:underline">
        ← Listagem
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Material</h1>
      {err && <p className="text-red-600 text-sm mt-4">{err}</p>}
      {row && (
        <div className="mt-6 max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 text-sm">
          <p>
            <span className="text-slate-500">Nome</span>
            <br />
            <span className="font-medium">{row.name}</span>
          </p>
          <p>
            <span className="text-slate-500">Código</span>
            <br />
            {row.code ?? '—'}
          </p>
          <p>
            <span className="text-slate-500">Tipo</span>
            <br />
            {row.materialType.name}
          </p>
          <p>
            <span className="text-slate-500">Unidade</span>
            <br />
            {row.unit.code} — {row.unit.name}
          </p>
          <p>
            <span className="text-slate-500">Descrição</span>
            <br />
            {row.description ?? '—'}
          </p>
          <p>
            <span className="text-slate-500">Ativo</span>
            <br />
            {row.active ? 'Sim' : 'Não'}
          </p>
          {canMutate && (
            <Link href={`/materiais/${id}/editar`} className="inline-block text-brand-700 font-medium pt-2">
              Editar
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
