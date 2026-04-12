'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { BrDecimalInput } from '@/components/BrDecimalInput';
import { api, getToken } from '@/lib/api';
import { parseBrDecimal } from '@/lib/br-decimal';
import { fetchItemsForSelect } from '@/lib/paginated-api';

export default function EstoqueNovaEntradaPage() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [materials, setMaterials] = useState<
    { id: string; name: string; unit: { code: string; name: string } }[]
  >([]);
  const [deposits, setDeposits] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ materialId: '', depositId: '', quantity: '', reference: '' });

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    Promise.all([
      fetchItemsForSelect<{
        id: string;
        name: string;
        unit: { code: string; name: string };
      }>('/materials'),
      fetchItemsForSelect<{ id: string; tradeName: string }>('/establishments?role=DEPOSIT').then(
        (rows) => rows.map((x) => ({ id: x.id, name: x.tradeName })),
      ),
    ])
      .then(([mat, dep]) => {
        setMaterials(
          mat.map((x) => ({
            id: x.id,
            name: x.name,
            unit: x.unit,
          })),
        );
        setDeposits(dep);
      })
      .catch(() => {});
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const qty = parseBrDecimal(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErr('Informe uma quantidade válida (use vírgula para decimais, ex.: 1,5 ou 1.234,56).');
      return;
    }
    try {
      await api('/stock/entries', {
        method: 'POST',
        body: JSON.stringify({
          materialId: form.materialId,
          depositId: form.depositId,
          quantity: qty,
          reference: form.reference || undefined,
        }),
      });
      router.push('/estoque');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro');
    }
  }

  if (!getToken()) return null;

  const selectedMaterial = materials.find((m) => m.id === form.materialId);

  return (
    <div>
      <Link href="/estoque" className="text-sm text-brand-700 hover:underline">
        ← Estoque
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Nova entrada (coleta)</h1>
      <p className="text-slate-600 text-sm mt-1">
        Registre a quantidade recebida por material e depósito.
      </p>

      {err && <p className="text-red-600 text-sm mt-4">{err}</p>}

      <form
        onSubmit={onSubmit}
        className="mt-6 max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div className="md:col-span-2">
          <label className="text-xs text-slate-600">Material</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.materialId}
            onChange={(e) => setForm({ ...form, materialId: e.target.value })}
            required
          >
            <option value="">Selecione</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-slate-600">Depósito</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.depositId}
            onChange={(e) => setForm({ ...form, depositId: e.target.value })}
            required
          >
            <option value="">Selecione</option>
            {deposits.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-600">Quantidade</label>
          <div className="mt-1 flex items-stretch gap-2">
            <BrDecimalInput
              required
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              value={form.quantity}
              onChange={(v) => setForm({ ...form, quantity: v })}
            />
            {selectedMaterial && (
              <span
                className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 tabular-nums"
                title={selectedMaterial.unit.name}
              >
                {selectedMaterial.unit.code}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Máscara automática: milhares com ponto e vírgula decimal (ex.: 1.234,567). Ao sair do campo, o
            valor é normalizado.
          </p>
        </div>
        <div>
          <label className="text-xs text-slate-600">Referência</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
          />
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Registrar entrada
          </button>
          <Link
            href="/estoque"
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
