'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { BrDecimalInput } from '@/components/BrDecimalInput';
import { api, apiBlob, apiUpload, getToken } from '@/lib/api';
import { CancelToDashboard } from '@/components/CancelToDashboard';
import { formatBrDecimal, parseBrDecimal } from '@/lib/br-decimal';
import { canEdit } from '@/lib/permissions';

export default function SaidasEditarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [err, setErr] = useState('');
  const [documentOriginalName, setDocumentOriginalName] = useState<string | null>(null);
  const [documentNumberLegacy, setDocumentNumberLegacy] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    notes: '',
    totalValue: '',
  });

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!canEdit('saidas')) {
      router.replace(`/saidas/${id}`);
      return;
    }
    api<{
      documentNumber: string | null;
      documentOriginalName: string | null;
      notes: string | null;
      totalValue: string | null;
    }>(`/exits/${id}`)
      .then((r) => {
        let totalValue = '';
        if (r.totalValue != null && String(r.totalValue).trim() !== '') {
          const n = parseBrDecimal(String(r.totalValue));
          if (Number.isFinite(n)) {
            totalValue = formatBrDecimal(n, { maxFractionDigits: 2 });
          }
        }
        setDocumentOriginalName(r.documentOriginalName ?? null);
        setDocumentNumberLegacy(r.documentNumber ?? null);
        setForm({
          notes: r.notes ?? '',
          totalValue,
        });
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [id, router]);

  async function downloadDoc() {
    setErr('');
    try {
      const blob = await apiBlob(`/exits/${id}/document`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = documentOriginalName ?? 'documento';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao baixar');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    let totalValue: number | undefined;
    if (form.totalValue.trim() !== '') {
      const n = parseBrDecimal(form.totalValue);
      if (!Number.isFinite(n) || n < 0) {
        setErr('Valor total inválido.');
        return;
      }
      totalValue = n;
    }
    try {
      await api(`/exits/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          notes: form.notes || undefined,
          totalValue,
        }),
      });
      if (documentFile) {
        await apiUpload(`/exits/${id}/document`, documentFile);
      }
      router.push(`/saidas/${id}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro');
    }
  }

  if (!getToken()) return null;
  if (!canEdit('saidas')) return null;

  return (
    <div>
      <Link href={`/saidas/${id}`} className="text-sm text-brand-700 hover:underline">
        ← Visualizar
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Editar saída</h1>
      {err && <p className="text-red-600 text-sm my-4">{err}</p>}
      <form
        onSubmit={submit}
        className="mt-4 max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
      >
        <div>
          <label className="text-xs text-slate-600">Documento comprovante</label>
          {documentOriginalName ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-700 truncate max-w-full">{documentOriginalName}</span>
              <button
                type="button"
                onClick={downloadDoc}
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                Baixar
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Nenhum arquivo anexado.</p>
          )}
          {documentNumberLegacy && !documentOriginalName && (
            <p className="mt-1 text-xs text-amber-800">
              Referência legada (texto): {documentNumberLegacy}
            </p>
          )}
          <input
            type="file"
            className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200"
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
            onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
          />
          {documentFile && (
            <p className="mt-1 text-xs text-slate-500">Novo arquivo: {documentFile.name}</p>
          )}
        </div>
        <div>
          <label className="text-xs text-slate-600">Observações</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-slate-600">Valor total (R$)</label>
          <BrDecimalInput
            maxFractionDigits={2}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm tabular-nums"
            value={form.totalValue}
            onChange={(v) => setForm({ ...form, totalValue: v })}
          />
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
