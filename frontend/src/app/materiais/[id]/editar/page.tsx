'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { fetchItemsForSelect } from '@/lib/paginated-api';
import { CancelToDashboard } from '@/components/CancelToDashboard';
import { canEdit } from '@/lib/permissions';
import { suggestMaterialCodeFromName } from '@/lib/suggest-material-code';

type Opt = { id: string; name: string };
type UnitOpt = { id: string; code: string; name: string };

export default function MateriaisEditarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [err, setErr] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [types, setTypes] = useState<Opt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [form, setForm] = useState({
    materialTypeId: '',
    unitId: '',
    name: '',
    code: '',
    description: '',
    active: true,
  });

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!canEdit('materiais')) {
      router.replace('/materiais');
      return;
    }
    Promise.all([
      fetchItemsForSelect<Opt>('/material-types'),
      fetchItemsForSelect<UnitOpt>('/units'),
      api<{
        materialType: { id: string };
        unit: { id: string };
        name: string;
        code: string | null;
        description: string | null;
        active: boolean;
      }>(`/materials/${id}`),
    ])
      .then(([t, u, r]) => {
        setTypes(t);
        setUnits(u);
        setForm({
          materialTypeId: r.materialType.id,
          unitId: r.unit.id,
          name: r.name,
          code: r.code ?? '',
          description: r.description ?? '',
          active: r.active,
        });
        setCodeTouched(!!(r.code && r.code.trim() !== ''));
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [id, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api(`/materials/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          materialTypeId: form.materialTypeId,
          unitId: form.unitId,
          name: form.name,
          code: form.code || undefined,
          description: form.description || undefined,
          active: form.active,
        }),
      });
      router.push(`/materiais/${id}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro');
    }
  }

  if (!getToken() || !canEdit('materiais')) return null;

  return (
    <div>
      <Link href={`/materiais/${id}`} className="text-sm text-brand-700 hover:underline">
        ← Visualizar
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Editar material</h1>
      {err && <p className="text-red-600 text-sm my-4">{err}</p>}
      <form
        onSubmit={submit}
        className="mt-4 max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
      >
        <div>
          <label className="text-xs text-slate-600">Tipo</label>
          <select
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.materialTypeId}
            onChange={(e) => setForm({ ...form, materialTypeId: e.target.value })}
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-600">Unidade</label>
          <select
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.unitId}
            onChange={(e) => setForm({ ...form, unitId: e.target.value })}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-600">Nome</label>
          <input
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm((f) => ({
                ...f,
                name,
                code: codeTouched ? f.code : suggestMaterialCodeFromName(name),
              }));
            }}
          />
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs text-slate-600">Código</label>
            <button
              type="button"
              className="text-xs text-brand-700 hover:underline"
              onClick={() => {
                setCodeTouched(false);
                setForm((f) => ({ ...f, code: suggestMaterialCodeFromName(f.name) }));
              }}
            >
              Usar iniciais do nome
            </button>
          </div>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.code}
            onChange={(e) => {
              setCodeTouched(true);
              setForm({ ...form, code: e.target.value });
            }}
            placeholder="Ex.: iniciais ou código interno"
          />
          <p className="text-xs text-slate-500 mt-1">
            Com código já cadastrado, o nome não altera o código; use o botão acima para recalcular.
          </p>
        </div>
        <div>
          <label className="text-xs text-slate-600">Descrição</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Ativo
        </label>
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
