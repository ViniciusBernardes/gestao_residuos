'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { canEdit } from '@/lib/permissions';

type Row = { id: string; name: string; description: string | null; active: boolean; createdAt: string };

export default function TiposMaterialVerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api<Row>(`/material-types/${id}`)
      .then(setRow)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [id, router]);

  if (!getToken()) return null;

  const canMutate = canEdit('config_tipos_material');

  return (
    <div>
      <Link href="/tipos-material" className="text-sm text-brand-700 hover:underline">
        ← Listagem
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Tipo de material</h1>
      {err && <p className="text-red-600 text-sm mt-4">{err}</p>}
      {row && (
        <div className="mt-6 max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 text-sm">
          <div>
            <span className="text-slate-500">Nome</span>
            <p className="font-medium text-slate-800">{row.name}</p>
          </div>
          <div>
            <span className="text-slate-500">Descrição</span>
            <p className="text-slate-800">{row.description ?? '—'}</p>
          </div>
          <div>
            <span className="text-slate-500">Ativo</span>
            <p className="text-slate-800">{row.active ? 'Sim' : 'Não'}</p>
          </div>
          <div>
            <span className="text-slate-500">Criado em</span>
            <p className="text-slate-800">{new Date(row.createdAt).toLocaleString('pt-BR')}</p>
          </div>
          <div className="pt-4 flex flex-wrap gap-3">
            {canMutate && (
              <Link
                href={`/tipos-material/${id}/editar`}
                className="text-brand-700 font-medium hover:underline"
              >
                Editar
              </Link>
            )}
            <Link href="/tipos-material" className="text-slate-600 hover:underline">
              Voltar à listagem
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
