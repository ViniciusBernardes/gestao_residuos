'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BrDecimalInput } from '@/components/BrDecimalInput';
import { api, apiUpload, getToken } from '@/lib/api';
import { CancelToDashboard } from '@/components/CancelToDashboard';
import { formatBrDecimal, parseBrDecimal } from '@/lib/br-decimal';
import { formatQty } from '@/lib/format-qty';
import { fetchItemsForSelect } from '@/lib/paginated-api';

type MaterialOpt = { id: string; name: string };

type StockBreakdown = {
  material: {
    id: string;
    name: string;
    code: string | null;
    unit: { code: string; name: string };
  };
  perDeposit: {
    depositId: string;
    depositName: string;
    depositCode: string | null;
    quantity: string;
  }[];
};

function hasPositiveQty(qty: string): boolean {
  const n = parseBrDecimal(qty);
  return Number.isFinite(n) && n > 0;
}

function qtyToBrInput(s: string): string {
  const n = parseBrDecimal(s);
  return Number.isFinite(n) ? formatBrDecimal(n, { maxFractionDigits: 6 }) : '';
}

export default function SaidasNovoPage() {
  const router = useRouter();
  const [destinations, setDestinations] = useState<{ id: string; name: string }[]>([]);
  const [materials, setMaterials] = useState<MaterialOpt[]>([]);
  const [err, setErr] = useState('');
  const [stockLoading, setStockLoading] = useState(false);
  const [stockDeposits, setStockDeposits] = useState<
    { id: string; name: string; code: string | null; quantity: string }[]
  >([]);
  const [materialUnit, setMaterialUnit] = useState<{ code: string; name: string } | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    establishmentId: '',
    materialId: '',
    depositId: '',
    quantity: '',
    unitPrice: '',
    notes: '',
  });

  const lineTotalDisplay = useMemo(() => {
    if (form.unitPrice.trim() === '') return null;
    const qtyN = parseBrDecimal(form.quantity);
    const priceN = parseBrDecimal(form.unitPrice);
    if (!Number.isFinite(qtyN) || qtyN <= 0 || !Number.isFinite(priceN) || priceN < 0) return null;
    return (qtyN * priceN).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }, [form.quantity, form.unitPrice]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    Promise.all([
      fetchItemsForSelect<{ id: string; tradeName: string }>('/establishments?role=DESTINATION').then(
        (rows) => rows.map((x) => ({ id: x.id, name: x.tradeName })),
      ),
      fetchItemsForSelect<MaterialOpt>('/materials'),
    ])
      .then(([c, m]) => {
        setDestinations(c);
        setMaterials(m);
        setForm((prev) => ({
          ...prev,
          establishmentId: prev.establishmentId || c[0]?.id || '',
        }));
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [router]);

  useEffect(() => {
    const mid = form.materialId;
    if (!mid) {
      setStockDeposits([]);
      setMaterialUnit(null);
      setForm((prev) => ({ ...prev, depositId: '', quantity: '' }));
      return;
    }

    let cancelled = false;
    setStockLoading(true);
    setErr('');
    setStockDeposits([]);
    setMaterialUnit(null);
    api<StockBreakdown>(`/stock/overview/materials/${mid}`)
      .then((b) => {
        if (cancelled) return;
        const withStock = b.perDeposit
          .filter((p) => hasPositiveQty(p.quantity))
          .sort((a, b) => a.depositName.localeCompare(b.depositName, 'pt-BR'));
        setMaterialUnit(b.material.unit);
        setStockDeposits(
          withStock.map((p) => ({
            id: p.depositId,
            name: p.depositName,
            code: p.depositCode,
            quantity: p.quantity,
          })),
        );
        setForm((prev) => {
          if (prev.materialId !== mid) return prev;
          if (withStock.length === 1) {
            return { ...prev, depositId: withStock[0].depositId, quantity: '' };
          }
          return { ...prev, depositId: '', quantity: '' };
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Erro ao carregar estoque do material');
          setStockDeposits([]);
          setMaterialUnit(null);
        }
      })
      .finally(() => {
        if (!cancelled) setStockLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.materialId]);

  const selectedDeposit = stockDeposits.find((d) => d.id === form.depositId);
  const availableQty = selectedDeposit ? parseBrDecimal(selectedDeposit.quantity) : NaN;

  function setQuantityTotal() {
    if (!selectedDeposit || !Number.isFinite(availableQty)) return;
    setForm((prev) => ({ ...prev, quantity: qtyToBrInput(selectedDeposit.quantity) }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!form.materialId) {
      setErr('Selecione o material.');
      return;
    }
    if (!form.depositId) {
      setErr('Selecione o depósito.');
      return;
    }
    const qty = parseBrDecimal(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErr('Informe uma quantidade válida (vírgula para decimais).');
      return;
    }
    if (Number.isFinite(availableQty) && qty > availableQty) {
      setErr(
        `Quantidade acima do disponível no depósito (máx. ${formatQty(selectedDeposit!.quantity)} ${materialUnit?.code ?? ''}).`,
      );
      return;
    }
    let unitPrice: number | undefined;
    if (form.unitPrice.trim() !== '') {
      const p = parseBrDecimal(form.unitPrice);
      if (!Number.isFinite(p) || p < 0) {
        setErr('Preço unitário inválido.');
        return;
      }
      unitPrice = p;
    }
    try {
      const created = await api<{ id: string }>('/exits', {
        method: 'POST',
        body: JSON.stringify({
          establishmentId: form.establishmentId,
          items: [
            {
              materialId: form.materialId,
              depositId: form.depositId,
              quantity: qty,
              unitPrice,
            },
          ],
          notes: form.notes || undefined,
        }),
      });
      if (documentFile) {
        try {
          await apiUpload(`/exits/${created.id}/document`, documentFile);
        } catch {
          setErr(
            'Saída registrada, mas o envio do arquivo falhou. Use “Editar cabeçalho” na saída para anexar o documento.',
          );
          router.push(`/saidas/${created.id}/editar`);
          return;
        }
      }
      router.push('/saidas');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro');
    }
  }

  if (!getToken()) return null;

  return (
    <div>
      <Link href="/saidas" className="text-sm text-brand-700 hover:underline">
        ← Listagem
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Nova saída</h1>
      <p className="text-slate-600 text-sm mt-1 max-w-xl">
        Escolha o material para listar apenas os depósitos com saldo. Informe quantidade parcial ou use
        saída total.
      </p>
      {err && <p className="text-red-600 text-sm my-4">{err}</p>}
      <form
        onSubmit={submit}
        className="mt-4 max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm grid gap-4 md:grid-cols-2"
      >
        <div>
          <label className="text-xs text-slate-600">Destino final</label>
          <select
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.establishmentId}
            onChange={(e) => setForm({ ...form, establishmentId: e.target.value })}
          >
            {destinations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-600">Material</label>
          <select
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.materialId}
            onChange={(e) =>
              setForm({ ...form, materialId: e.target.value, depositId: '', quantity: '' })
            }
          >
            <option value="">Selecione o material</option>
            {materials.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-slate-600">Depósito</label>
          {!form.materialId ? (
            <p className="mt-2 text-sm text-slate-500">Selecione um material para ver os depósitos.</p>
          ) : stockLoading ? (
            <p className="mt-2 text-sm text-slate-500">Carregando depósitos com saldo…</p>
          ) : stockDeposits.length === 0 ? (
            <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Nenhum depósito com saldo deste material. Registre uma entrada de estoque antes.
            </p>
          ) : (
            <select
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.depositId}
              onChange={(e) => setForm({ ...form, depositId: e.target.value, quantity: '' })}
            >
              <option value="">Selecione o depósito</option>
              {stockDeposits.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.code ? ` (${c.code})` : ''} — disponível: {formatQty(c.quantity)}{' '}
                  {materialUnit?.code ?? ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {form.depositId && selectedDeposit && materialUnit && (
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
            <p className="text-slate-700">
              <span className="font-medium text-slate-800">Disponível neste depósito:</span>{' '}
              <span className="tabular-nums font-semibold">
                {formatQty(selectedDeposit.quantity)} {materialUnit.code}
              </span>
              <span className="text-slate-500"> ({materialUnit.name})</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                onClick={setQuantityTotal}
              >
                Saída total (todo o saldo)
              </button>
              <span className="text-xs text-slate-500 self-center">
                Ou informe abaixo uma quantidade menor (saída parcial).
              </span>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-slate-600">Quantidade da saída</label>
          <BrDecimalInput
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm tabular-nums"
            value={form.quantity}
            onChange={(v) => setForm({ ...form, quantity: v })}
            disabled={!form.depositId}
          />
        </div>
        <div>
          <label className="text-xs text-slate-600">Preço unit. (opcional)</label>
          <BrDecimalInput
            maxFractionDigits={4}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm tabular-nums"
            value={form.unitPrice}
            onChange={(v) => setForm({ ...form, unitPrice: v })}
          />
        </div>
        {lineTotalDisplay != null && (
          <div className="md:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm">
            <span className="text-slate-600">Valor total desta saída: </span>
            <span className="font-semibold tabular-nums text-emerald-900">{lineTotalDisplay}</span>
          </div>
        )}
        <div className="md:col-span-2">
          <label className="text-xs text-slate-600">Documento comprovante (opcional)</label>
          <input
            type="file"
            className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200"
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
            onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
          />
          {documentFile && (
            <p className="mt-1 text-xs text-slate-500">Selecionado: {documentFile.name}</p>
          )}
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-slate-600">Observações</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-lg bg-brand-600 text-white py-2.5 px-4 text-sm font-medium disabled:opacity-50"
            disabled={!form.materialId || !form.depositId || stockDeposits.length === 0}
          >
            Registrar saída
          </button>
          <CancelToDashboard />
        </div>
      </form>
    </div>
  );
}
