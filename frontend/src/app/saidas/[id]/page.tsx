'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, apiBlob, getToken } from '@/lib/api';
import { formatQty } from '@/lib/format-qty';
import { parseBrDecimal } from '@/lib/br-decimal';
import { canEdit } from '@/lib/permissions';

type Exit = {
  id: string;
  exitedAt: string;
  totalValue: string | null;
  documentNumber: string | null;
  documentOriginalName: string | null;
  notes: string | null;
  center: { id: string; name: string };
  items: { quantity: string; material: { name: string; code: string | null } }[];
};

export default function SaidasVerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Exit | null>(null);
  const [err, setErr] = useState('');
  const canEditHeader = canEdit('saidas');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api<Exit>(`/exits/${id}`)
      .then(setRow)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [id, router]);

  async function downloadDoc() {
    setErr('');
    try {
      const blob = await apiBlob(`/exits/${id}/document`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = row?.documentOriginalName ?? 'documento';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao baixar');
    }
  }

  if (!getToken()) return null;

  return (
    <div>
      <Link href="/saidas" className="text-sm text-brand-700 hover:underline">
        ← Listagem
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Saída</h1>
      {err && <p className="text-red-600 text-sm mt-4">{err}</p>}
      {row && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-sm">
          <p>
            <span className="text-slate-500">Centro</span>
            <br />
            <span className="font-medium">{row.center.name}</span>
          </p>
          <p>
            <span className="text-slate-500">Data</span>
            <br />
            {new Date(row.exitedAt).toLocaleString('pt-BR')}
          </p>
          {row.documentOriginalName && (
            <p>
              <span className="text-slate-500">Documento comprovante</span>
              <br />
              <span className="font-medium">{row.documentOriginalName}</span>
              <br />
              <button
                type="button"
                onClick={downloadDoc}
                className="mt-1 text-brand-700 font-medium hover:underline"
              >
                Baixar arquivo
              </button>
            </p>
          )}
          {row.documentNumber && !row.documentOriginalName && (
            <p>
              <span className="text-slate-500">Documento (referência legada)</span>
              <br />
              {row.documentNumber}
            </p>
          )}
          {(() => {
            if (row.totalValue == null || String(row.totalValue).trim() === '') return null;
            const n = parseBrDecimal(String(row.totalValue));
            if (!Number.isFinite(n)) return null;
            return (
              <p>
                <span className="text-slate-500">Valor total</span>
                <br />
                <span className="font-medium text-emerald-700">
                  {n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </p>
            );
          })()}
          {row.notes && (
            <p>
              <span className="text-slate-500">Observações</span>
              <br />
              {row.notes}
            </p>
          )}
          <div>
            <span className="text-slate-500">Itens</span>
            <ul className="mt-1 list-disc list-inside text-slate-700">
              {row.items.map((it) => (
                <li key={it.material.name + it.quantity}>
                  {it.material.name}: {formatQty(it.quantity)}
                </li>
              ))}
            </ul>
          </div>
          {canEditHeader && (
            <Link href={`/saidas/${id}/editar`} className="inline-block text-brand-700 font-medium">
              Editar cabeçalho
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
