'use client';

import Link from 'next/link';
import { Fragment, FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrDecimalInput } from '@/components/BrDecimalInput';
import { PaginationBar } from '@/components/PaginationBar';
import { api, getToken } from '@/lib/api';
import { formatBrDecimal, parseBrDecimal } from '@/lib/br-decimal';
import { formatQty } from '@/lib/format-qty';
import { fetchItemsForSelect, fetchPaginated } from '@/lib/paginated-api';
import { canEdit } from '@/lib/permissions';
import { PAGE_SIZE } from '@/lib/types';

type Unit = { code: string; name: string };

type OverviewRow = {
  material: { id: string; name: string; code: string | null; unit: Unit };
  totalQuantity: string;
  deposits: { id: string; name: string; code: string | null }[];
};

type Breakdown = {
  material: { id: string; name: string; code: string | null; unit: Unit };
  perDeposit: {
    depositId: string;
    depositName: string;
    depositCode: string | null;
    quantity: string;
    unitCode: string;
    unitName: string;
    updatedAt: string;
  }[];
  movements: {
    id: string;
    occurredAt: string;
    type: string;
    quantity: string;
    depositSummary: string;
    userName: string;
  }[];
};

type StockBreakdownLite = {
  perDeposit: { depositId: string; depositName: string; quantity: string }[];
};

function movementKindLabel(type: string): string {
  switch (type) {
    case 'ENTRY':
      return 'Entrada';
    case 'EXIT':
      return 'Saída';
    case 'TRANSFER_OUT':
      return 'Transferência (saída)';
    case 'TRANSFER_IN':
      return 'Transferência (entrada)';
    case 'ADJUSTMENT':
      return 'Ajuste';
    default:
      return type;
  }
}

function depositQtyPositive(qty: string): boolean {
  const n = parseBrDecimal(qty);
  return Number.isFinite(n) && n > 0;
}

function qtyToBrInput(s: string): string {
  const n = parseBrDecimal(s);
  return Number.isFinite(n) ? formatBrDecimal(n, { maxFractionDigits: 6 }) : '0';
}

function PencilIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function TransferIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  );
}

export default function EstoquePage() {
  const router = useRouter();
  const canMutate = canEdit('estoque');
  const canTransfer = canEdit('estoque');
  const [page, setPage] = useState(1);
  const [overview, setOverview] = useState({
    items: [] as OverviewRow[],
    total: 0,
    totalPages: 1,
    limit: PAGE_SIZE,
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const [qtyEditRow, setQtyEditRow] = useState<OverviewRow | null>(null);
  const [qtyModalLoading, setQtyModalLoading] = useState(false);
  const [qtyModalErr, setQtyModalErr] = useState('');
  const [qtyDeposits, setQtyDeposits] = useState<{ id: string; name: string }[]>([]);
  const [qtyByDeposit, setQtyByDeposit] = useState<Record<string, string>>({});
  const [qtyDepositId, setQtyDepositId] = useState('');
  const [qtyInput, setQtyInput] = useState('');
  const [qtySaving, setQtySaving] = useState(false);

  const [xferRow, setXferRow] = useState<OverviewRow | null>(null);
  const [xferLoading, setXferLoading] = useState(false);
  const [xferErr, setXferErr] = useState('');
  const [xferSaving, setXferSaving] = useState(false);
  const [xferFromList, setXferFromList] = useState<{ id: string; name: string; quantity: string }[]>(
    [],
  );
  const [xferAllDeposits, setXferAllDeposits] = useState<{ id: string; name: string }[]>([]);
  const [xferFromId, setXferFromId] = useState('');
  const [xferToId, setXferToId] = useState('');
  const [xferQty, setXferQty] = useState('');
  const [xferRef, setXferRef] = useState('');

  const loadOverview = useCallback(() => {
    if (!getToken()) return;
    setLoading(true);
    setErr('');
    fetchPaginated<OverviewRow>('/stock/overview/materials', page, PAGE_SIZE)
      .then((r) =>
        setOverview({
          items: r.items,
          total: r.total,
          totalPages: r.totalPages,
          limit: r.limit,
        }),
      )
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    loadOverview();
  }, [router, loadOverview]);

  async function toggleRow(materialId: string) {
    if (expandedId === materialId) {
      setExpandedId(null);
      setBreakdown(null);
      return;
    }
    setExpandedId(materialId);
    setBreakdown(null);
    setBreakdownLoading(true);
    setErr('');
    try {
      const d = await api<Breakdown>(`/stock/overview/materials/${materialId}`);
      setBreakdown(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar detalhe');
      setExpandedId(null);
    } finally {
      setBreakdownLoading(false);
    }
  }

  async function openQtyModal(row: OverviewRow) {
    setQtyEditRow(row);
    setQtyModalErr('');
    setQtyModalLoading(true);
    setQtyDeposits([]);
    setQtyByDeposit({});
    setQtyDepositId('');
    setQtyInput('');
    try {
      const breakdown = await api<StockBreakdownLite>(`/stock/overview/materials/${row.material.id}`);
      const withStock = breakdown.perDeposit.filter((p) => depositQtyPositive(p.quantity));
      const sorted = [...withStock].sort((a, b) =>
        a.depositName.localeCompare(b.depositName, 'pt-BR'),
      );
      const map: Record<string, string> = {};
      for (const p of sorted) {
        map[p.depositId] = p.quantity;
      }
      setQtyByDeposit(map);
      setQtyDeposits(sorted.map((p) => ({ id: p.depositId, name: p.depositName })));
      const firstId = sorted[0]?.depositId ?? '';
      setQtyDepositId(firstId);
      setQtyInput(firstId ? qtyToBrInput(map[firstId]!) : '0');
    } catch (e) {
      setQtyModalErr(e instanceof Error ? e.message : 'Erro ao carregar estoque');
    } finally {
      setQtyModalLoading(false);
    }
  }

  function closeQtyModal() {
    setQtyEditRow(null);
    setQtyModalErr('');
    setQtyModalLoading(false);
    setQtySaving(false);
  }

  function onQtyDepositChange(id: string) {
    setQtyDepositId(id);
    setQtyInput(id ? qtyToBrInput(qtyByDeposit[id] ?? '0') : '0');
  }

  async function openTransferModal(row: OverviewRow) {
    setXferRow(row);
    setXferErr('');
    setXferLoading(true);
    setXferFromList([]);
    setXferAllDeposits([]);
    setXferFromId('');
    setXferToId('');
    setXferQty('');
    setXferRef('');
    try {
      const [breakdown, depRows] = await Promise.all([
        api<StockBreakdownLite>(`/stock/overview/materials/${row.material.id}`),
        fetchItemsForSelect<{ id: string; tradeName: string }>('/establishments?role=DEPOSIT').then(
          (rows) =>
            rows
              .map((x) => ({ id: x.id, name: x.tradeName }))
              .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        ),
      ]);
      const withStock = breakdown.perDeposit
        .filter((p) => depositQtyPositive(p.quantity))
        .sort((a, b) => a.depositName.localeCompare(b.depositName, 'pt-BR'));
      const fromList = withStock.map((p) => ({
        id: p.depositId,
        name: p.depositName,
        quantity: p.quantity,
      }));
      setXferFromList(fromList);
      setXferAllDeposits(depRows);
      const firstFrom = fromList[0]?.id ?? '';
      setXferFromId(firstFrom);
      const defaultTo = depRows.find((d) => d.id !== firstFrom)?.id ?? '';
      setXferToId(defaultTo);
    } catch (e) {
      setXferErr(e instanceof Error ? e.message : 'Erro ao carregar dados');
    } finally {
      setXferLoading(false);
    }
  }

  function closeTransferModal() {
    setXferRow(null);
    setXferErr('');
    setXferLoading(false);
    setXferSaving(false);
  }

  function onXferFromChange(id: string) {
    setXferFromId(id);
    setXferToId((to) => {
      if (to !== id) return to;
      const other = xferAllDeposits.find((d) => d.id !== id);
      return other?.id ?? '';
    });
  }

  async function submitTransferModal(e: FormEvent) {
    e.preventDefault();
    if (!xferRow || !xferFromId || !xferToId) return;
    setXferErr('');
    if (xferFromId === xferToId) {
      setXferErr('Origem e destino devem ser diferentes.');
      return;
    }
    const qty = parseBrDecimal(xferQty);
    const fromRow = xferFromList.find((f) => f.id === xferFromId);
    const available = parseBrDecimal(fromRow?.quantity ?? '0');
    if (!Number.isFinite(qty) || qty <= 0) {
      setXferErr('Informe uma quantidade válida.');
      return;
    }
    if (qty > available) {
      setXferErr(
        `No máximo ${formatQty(fromRow?.quantity ?? '0')} ${xferRow.material.unit.code} no depósito de origem.`,
      );
      return;
    }
    setXferSaving(true);
    try {
      await api('/stock/transfers', {
        method: 'POST',
        body: JSON.stringify({
          materialId: xferRow.material.id,
          depositFromId: xferFromId,
          depositToId: xferToId,
          quantity: qty,
          reference: xferRef.trim() || undefined,
        }),
      });
      closeTransferModal();
      await refreshAll();
    } catch (ex) {
      setXferErr(ex instanceof Error ? ex.message : 'Erro ao transferir');
    } finally {
      setXferSaving(false);
    }
  }

  async function submitQtyAdjust(e: FormEvent) {
    e.preventDefault();
    if (!qtyEditRow || !qtyDepositId) return;
    setQtyModalErr('');
    let current = parseBrDecimal(qtyByDeposit[qtyDepositId] ?? '0');
    if (!Number.isFinite(current)) current = 0;
    const target = parseBrDecimal(qtyInput);
    if (!Number.isFinite(target)) {
      setQtyModalErr('Informe uma quantidade válida.');
      return;
    }
    const delta = target - current;
    if (delta === 0) {
      closeQtyModal();
      return;
    }
    setQtySaving(true);
    try {
      await api('/stock/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          materialId: qtyEditRow.material.id,
          depositId: qtyDepositId,
          quantityDelta: delta,
          notes: 'Ajuste pela listagem de estoque',
        }),
      });
      closeQtyModal();
      await refreshAll();
    } catch (ex) {
      setQtyModalErr(ex instanceof Error ? ex.message : 'Erro ao salvar');
    } finally {
      setQtySaving(false);
    }
  }

  async function refreshAll() {
    loadOverview();
    if (expandedId) {
      setBreakdownLoading(true);
      try {
        const d = await api<Breakdown>(`/stock/overview/materials/${expandedId}`);
        setBreakdown(d);
      } catch {
        /* ignore */
      } finally {
        setBreakdownLoading(false);
      }
    }
  }

  if (!getToken()) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Estoque</h1>
          <p className="text-slate-600 text-sm max-w-2xl">
            Código, unidade, quantidade total e depósitos com saldo. O botão Nova entrada (coleta) abre a
            página para registrar coleta. Clique na linha para ver saldo por depósito e o registro de
            movimentações. Gestores podem ajustar a quantidade pelo ícone de edição.
          </p>
        </div>
        <Link
          href="/estoque/nova-entrada"
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 shadow-sm inline-flex items-center justify-center"
        >
          Nova entrada (coleta)
        </Link>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Material</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Unidade</th>
              <th className="px-4 py-3 font-medium w-32">Quantidade</th>
              <th className="px-4 py-3 font-medium">Depósitos</th>
              <th className="px-4 py-3 font-medium w-14 text-right" aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : overview.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhum material cadastrado.
                </td>
              </tr>
            ) : (
              overview.items.map((row) => (
                <Fragment key={row.material.id}>
                  <tr
                    className={`border-t border-slate-100 cursor-pointer transition-colors ${
                      expandedId === row.material.id ? 'bg-brand-50/60' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => void toggleRow(row.material.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void toggleRow(row.material.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-expanded={expandedId === row.material.id}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{row.material.name}</td>
                    <td className="px-4 py-3 text-slate-600">{row.material.code ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="tabular-nums">{row.material.unit.code}</span>
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {formatQty(row.totalQuantity || '0')}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.deposits.length === 0
                        ? '—'
                        : row.deposits.map((d) => d.name).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center justify-end gap-0.5">
                        {canTransfer && (
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                            title="Transferir entre depósitos"
                            onClick={() => void openTransferModal(row)}
                          >
                            <TransferIcon />
                          </button>
                        )}
                        {canMutate && (
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50"
                            title="Ajustar quantidade"
                            onClick={() => void openQtyModal(row)}
                          >
                            <PencilIcon />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === row.material.id && (
                    <tr className="border-t border-slate-200 bg-slate-50/80">
                      <td colSpan={6} className="px-4 py-4">
                        {breakdownLoading && (
                          <p className="text-sm text-slate-600 py-4">Carregando detalhes…</p>
                        )}
                        {!breakdownLoading && breakdown && (
                          <div className="flex flex-col gap-6">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                                Material × depósitos
                              </h3>
                              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-100 text-left text-slate-600 text-xs uppercase tracking-wide">
                                    <tr>
                                      <th className="px-3 py-2">Depósito</th>
                                      <th className="px-3 py-2">Quantidade</th>
                                      <th className="px-3 py-2">Unidade</th>
                                      <th className="px-3 py-2">Última atualização</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {breakdown.perDeposit.length === 0 ? (
                                      <tr>
                                        <td colSpan={4} className="px-3 py-4 text-slate-500 text-center">
                                          Sem saldo registrado em depósitos (nenhuma linha de estoque).
                                        </td>
                                      </tr>
                                    ) : (
                                      breakdown.perDeposit.map((d) => (
                                        <tr key={d.depositId} className="border-t border-slate-100">
                                          <td className="px-3 py-2">
                                            {d.depositName}
                                            {d.depositCode && (
                                              <span className="text-slate-400 text-xs ml-1">
                                                ({d.depositCode})
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 tabular-nums font-medium">
                                            {formatQty(d.quantity)}
                                          </td>
                                          <td className="px-3 py-2">
                                            {d.unitCode}
                                            <span className="text-slate-400 text-xs ml-1">
                                              {d.unitName}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                                            {new Date(d.updatedAt).toLocaleString('pt-BR')}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                                Registro de log
                              </h3>
                              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden max-h-[min(420px,50vh)] overflow-y-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-100 text-left text-slate-600 text-xs uppercase tracking-wide sticky top-0">
                                    <tr>
                                      <th className="px-3 py-2">Data</th>
                                      <th className="px-3 py-2 whitespace-nowrap">Tipo</th>
                                      <th className="px-3 py-2">Quantidade</th>
                                      <th className="px-3 py-2">Depósito</th>
                                      <th className="px-3 py-2">Usuário</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {breakdown.movements.length === 0 ? (
                                      <tr>
                                        <td colSpan={5} className="px-3 py-4 text-slate-500 text-center">
                                          Nenhuma movimentação registrada para este material.
                                        </td>
                                      </tr>
                                    ) : (
                                      breakdown.movements.map((m) => (
                                        <tr key={m.id} className="border-t border-slate-100">
                                          <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                                            {new Date(m.occurredAt).toLocaleString('pt-BR')}
                                          </td>
                                          <td className="px-3 py-2 whitespace-nowrap">
                                            <span
                                              className={
                                                m.type === 'EXIT' || m.type === 'TRANSFER_OUT'
                                                  ? 'text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-xs font-medium'
                                                  : m.type === 'ENTRY' || m.type === 'TRANSFER_IN'
                                                    ? 'text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-xs font-medium'
                                                    : 'text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs font-medium'
                                              }
                                            >
                                              {movementKindLabel(m.type)}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 tabular-nums">{formatQty(m.quantity)}</td>
                                          <td className="px-3 py-2 text-slate-700">{m.depositSummary}</td>
                                          <td className="px-3 py-2 text-slate-600">{m.userName}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
        <PaginationBar
          page={page}
          totalPages={overview.totalPages}
          total={overview.total}
          limit={overview.limit}
          onPageChange={(p) => {
            setPage(p);
            setExpandedId(null);
            setBreakdown(null);
          }}
        />
      </div>

      {qtyEditRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="estoque-qty-modal-title"
          onClick={(e) => e.target === e.currentTarget && !qtySaving && closeQtyModal()}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="estoque-qty-modal-title" className="text-lg font-semibold text-slate-800">
              Ajustar quantidade
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {qtyEditRow.material.name}
              {qtyEditRow.material.code && (
                <span className="text-slate-500"> · {qtyEditRow.material.code}</span>
              )}
              <span className="text-slate-500"> · {qtyEditRow.material.unit.code}</span>
            </p>

            {qtyModalErr && <p className="mt-3 text-sm text-red-600">{qtyModalErr}</p>}

            {qtyModalLoading ? (
              <p className="mt-6 text-sm text-slate-600">Carregando…</p>
            ) : qtyDeposits.length === 0 ? (
              <p className="mt-6 text-sm text-slate-600">
                Não há depósito com saldo deste material. Use uma entrada de estoque para registrar
                quantidade em um depósito antes de ajustar.
              </p>
            ) : (
              <form onSubmit={submitQtyAdjust} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600">Depósito</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={qtyDepositId}
                    onChange={(e) => onQtyDepositChange(e.target.value)}
                    required
                  >
                    {qtyDeposits.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Quantidade neste depósito</label>
                  <div className="mt-1 flex items-stretch gap-2">
                    <BrDecimalInput
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                      value={qtyInput}
                      onChange={setQtyInput}
                      required
                    />
                    <span
                      className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 tabular-nums"
                      title={qtyEditRow.material.unit.name}
                    >
                      {qtyEditRow.material.unit.code}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={closeQtyModal}
                    disabled={qtySaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                    disabled={qtySaving}
                  >
                    {qtySaving ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {xferRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="estoque-xfer-modal-title"
          onClick={(e) => e.target === e.currentTarget && !xferSaving && closeTransferModal()}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="estoque-xfer-modal-title" className="text-lg font-semibold text-slate-800">
              Transferir entre depósitos
            </h2>
            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
              <span className="font-medium">{xferRow.material.name}</span>
              {xferRow.material.code && (
                <span className="text-slate-500"> · {xferRow.material.code}</span>
              )}
              <span className="text-slate-500"> · {xferRow.material.unit.code}</span>
            </div>

            {xferErr && <p className="mt-3 text-sm text-red-600">{xferErr}</p>}

            {xferLoading ? (
              <p className="mt-6 text-sm text-slate-600">Carregando…</p>
            ) : xferFromList.length === 0 ? (
              <p className="mt-6 text-sm text-slate-600">
                Não há depósito com saldo deste material. Registre uma entrada antes de transferir.
              </p>
            ) : xferAllDeposits.length < 2 ? (
              <p className="mt-6 text-sm text-slate-600">
                É necessário pelo menos dois depósitos cadastrados para transferir.
              </p>
            ) : (
              <form onSubmit={submitTransferModal} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600">Depósito de origem</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={xferFromId}
                    onChange={(e) => onXferFromChange(e.target.value)}
                    required
                  >
                    {xferFromList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({formatQty(d.quantity)} {xferRow.material.unit.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Depósito de destino</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={xferToId}
                    onChange={(e) => setXferToId(e.target.value)}
                    required
                  >
                    {xferAllDeposits
                      .filter((d) => d.id !== xferFromId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Quantidade</label>
                  <div className="mt-1 flex items-stretch gap-2">
                    <BrDecimalInput
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                      value={xferQty}
                      onChange={setXferQty}
                      placeholder={
                        xferFromId
                          ? `Máx. ${formatQty(xferFromList.find((f) => f.id === xferFromId)?.quantity ?? '0')}`
                          : ''
                      }
                      required
                    />
                    <span
                      className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 tabular-nums"
                      title={xferRow.material.unit.name}
                    >
                      {xferRow.material.unit.code}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Referência (opcional)</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={xferRef}
                    onChange={(e) => setXferRef(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={closeTransferModal}
                    disabled={xferSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                    disabled={xferSaving || !xferToId}
                  >
                    {xferSaving ? 'Transferindo…' : 'Transferir'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
