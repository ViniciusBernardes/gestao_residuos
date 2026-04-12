'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiUpload } from '@/lib/api';
import { formatCep, formatCnpj, formatCpf, formatMobile, onlyDigits } from '@/lib/masks';
import { fetchPaginated } from '@/lib/paginated-api';
import { CnaeActivitiesTable } from '@/components/CnaeActivitiesTable';

export type EstRole = 'DEPOSIT' | 'DESTINATION';

type Branch = { id: string; name: string; role: EstRole };
type Uf = { id: number; sigla: string; nome: string };
type Mun = { id: number; nome: string };

type EstDto = {
  id: string;
  role: EstRole;
  activityBranchId: string;
  legalName: string;
  tradeName: string;
  cnpj: string | null;
  stateReg: string | null;
  municipalReg: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  cityName: string | null;
  ufSigla: string | null;
  ibgeCityCode: number | null;
  receitaPayload: unknown;
  legalRepFullName: string | null;
  legalRepCpf: string | null;
  legalRepEmail: string | null;
  legalRepPhone: string | null;
  legalRepDocPath: string | null;
  code: string | null;
  legacyAddress: string | null;
};

type Props = {
  mode: 'create' | 'edit';
  establishmentId?: string;
  role: EstRole;
};

export function EstablishmentForm({ mode, establishmentId, role }: Props) {
  const router = useRouter();
  const [submitRole, setSubmitRole] = useState<EstRole>(role);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(mode === 'edit');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [ufs, setUfs] = useState<Uf[]>([]);
  const [munis, setMunis] = useState<Mun[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    activityBranchId: '',
    legalName: '',
    tradeName: '',
    cnpj: '',
    stateReg: '',
    municipalReg: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    cityName: '',
    ufSigla: '',
    ibgeCityCode: '' as number | '',
    legalRepFullName: '',
    legalRepCpf: '',
    legalRepEmail: '',
    legalRepPhone: '',
    code: '',
    legacyAddress: '',
    receitaPayload: null as Record<string, unknown> | null,
    hadDoc: false,
  });

  const loadMunis = useCallback(async (uf: string) => {
    const sigla = uf.toUpperCase().trim();
    if (sigla.length !== 2) {
      setMunis([]);
      return;
    }
    const list = await api<Mun[]>(`/integrations/ibge/municipios?uf=${encodeURIComponent(sigla)}`);
    setMunis(list);
  }, []);

  useEffect(() => {
    setSubmitRole(role);
  }, [role]);

  useEffect(() => {
    fetchPaginated<Branch>(`/activity-branches?role=${submitRole}`, 1, 200)
      .then((r) => {
        setBranches(r.items);
        if (mode === 'create' && r.items.length === 1) {
          setForm((f) => ({ ...f, activityBranchId: r.items[0].id }));
        }
      })
      .catch(() => setBranches([]));
  }, [submitRole, mode]);

  useEffect(() => {
    api<Uf[]>('/integrations/ibge/ufs')
      .then(setUfs)
      .catch(() => setUfs([]));
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || !establishmentId) return;
    setLoading(true);
    setErr('');
    api<EstDto>(`/establishments/${establishmentId}`)
      .then(async (est) => {
        setSubmitRole(est.role);
        setForm({
          activityBranchId: est.activityBranchId,
          legalName: est.legalName,
          tradeName: est.tradeName,
          cnpj: formatCnpj(est.cnpj ?? ''),
          stateReg: est.stateReg ?? '',
          municipalReg: est.municipalReg ?? '',
          cep: formatCep(est.cep ?? ''),
          street: est.street ?? '',
          number: est.number ?? '',
          complement: est.complement ?? '',
          district: est.district ?? '',
          cityName: est.cityName ?? '',
          ufSigla: est.ufSigla ?? '',
          ibgeCityCode: est.ibgeCityCode ?? '',
          legalRepFullName: est.legalRepFullName ?? '',
          legalRepCpf: est.legalRepCpf ? formatCpf(est.legalRepCpf) : '',
          legalRepEmail: est.legalRepEmail ?? '',
          legalRepPhone: est.legalRepPhone ? formatMobile(est.legalRepPhone) : '',
          code: est.code ?? '',
          legacyAddress: est.legacyAddress ?? '',
          receitaPayload: (est.receitaPayload as Record<string, unknown>) ?? null,
          hadDoc: !!est.legalRepDocPath,
        });
        if (est.ufSigla) await loadMunis(est.ufSigla);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [mode, establishmentId, loadMunis]);

  async function onCep() {
    setErr('');
    const cep = onlyDigits(form.cep, 8);
    if (cep.length !== 8) {
      setErr('Informe um CEP com 8 dígitos');
      return;
    }
    setBusy(true);
    try {
      const r = await api<{
        cep: string;
        street: string;
        district: string;
        complement: string;
        cityName: string;
        ufSigla: string;
        ibgeCityCode: number | null;
      }>(`/integrations/cep/${cep}`);
      setForm((f) => ({
        ...f,
        cep: formatCep(r.cep),
        street: r.street || f.street,
        district: r.district || f.district,
        complement: r.complement || f.complement,
        cityName: r.cityName || f.cityName,
        ufSigla: r.ufSigla || f.ufSigla,
        ibgeCityCode: r.ibgeCityCode ?? f.ibgeCityCode,
      }));
      if (r.ufSigla) await loadMunis(r.ufSigla);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'CEP não encontrado');
    } finally {
      setBusy(false);
    }
  }

  async function onCnpjLookup() {
    setErr('');
    const d = onlyDigits(form.cnpj, 14);
    if (d.length !== 14) {
      setErr('Informe os 14 dígitos do CNPJ para consultar');
      return;
    }
    setBusy(true);
    try {
      const j = await api<Record<string, unknown>>(
        `/integrations/cnpj?q=${encodeURIComponent(d)}`,
      );
      const cepRaw = (j.cep as string | undefined)?.replace(/\D/g, '') ?? '';
      setForm((f) => ({
        ...f,
        legalName: (j.razao_social as string) || f.legalName,
        tradeName:
          ((j.nome_fantasia as string) || (j.razao_social as string) || f.tradeName) as string,
        cep: cepRaw ? formatCep(cepRaw) : f.cep,
        street: (j.logradouro as string) || f.street,
        number: ((j.numero as string) ?? f.number) as string,
        complement: (j.complemento as string) || f.complement,
        district: (j.bairro as string) || f.district,
        cityName: (j.municipio as string) || f.cityName,
        ufSigla: ((j.uf as string) || f.ufSigla) as string,
        receitaPayload: j,
      }));
      const uf = (j.uf as string) || '';
      if (uf) {
        await loadMunis(uf);
        const nome = (j.municipio as string) || '';
        const cities = await api<Mun[]>(
          `/integrations/ibge/municipios?uf=${encodeURIComponent(uf.toUpperCase())}`,
        );
        const hit = cities.find((c) => c.nome === nome);
        if (hit) setForm((ff) => ({ ...ff, ibgeCityCode: hit.id }));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha na consulta CNPJ');
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const cnpjD = onlyDigits(form.cnpj, 14);
    if (cnpjD.length !== 14) {
      setErr('CNPJ deve ter 14 dígitos');
      return;
    }
    if (!form.activityBranchId) {
      setErr('Selecione o ramo de atividade');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        activityBranchId: form.activityBranchId,
        role: submitRole,
        legalName: form.legalName.trim(),
        tradeName: form.tradeName.trim(),
        cnpj: cnpjD,
        stateReg: form.stateReg.trim() || undefined,
        municipalReg: form.municipalReg.trim() || undefined,
        cep: onlyDigits(form.cep, 8) || undefined,
        street: form.street.trim() || undefined,
        number: form.number.trim() || undefined,
        complement: form.complement.trim() || undefined,
        district: form.district.trim() || undefined,
        cityName: form.cityName.trim() || undefined,
        ufSigla: form.ufSigla.trim().toUpperCase() || undefined,
        ibgeCityCode: form.ibgeCityCode === '' ? undefined : Number(form.ibgeCityCode),
        receitaPayload: form.receitaPayload ?? undefined,
        legalRepFullName: form.legalRepFullName.trim() || undefined,
        legalRepCpf: form.legalRepCpf ? onlyDigits(form.legalRepCpf, 11) : undefined,
        legalRepEmail: form.legalRepEmail.trim() || undefined,
        legalRepPhone: form.legalRepPhone ? onlyDigits(form.legalRepPhone, 11) : undefined,
        code: form.code.trim() || undefined,
        legacyAddress: form.legacyAddress.trim() || undefined,
      };

      if (mode === 'create') {
        const created = await api<{ id: string }>('/establishments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (file) {
          await apiUpload(`/establishments/${created.id}/legal-document`, file);
        }
        router.push(`/estabelecimentos?role=${submitRole}`);
      } else if (establishmentId) {
        await api(`/establishments/${establishmentId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        if (file) {
          await apiUpload(`/establishments/${establishmentId}/legal-document`, file);
        }
        router.push(`/estabelecimentos/${establishmentId}`);
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro ao salvar');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-slate-600 text-sm">Carregando…</p>;
  }

  const listHref = `/estabelecimentos?role=${submitRole}`;

  return (
    <div>
      <Link href={listHref} className="text-sm text-brand-700 hover:underline">
        ← Listagem
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">
        {mode === 'create' ? 'Novo estabelecimento' : 'Editar estabelecimento'}
      </h1>
      <p className="text-slate-600 text-sm mt-1">
        {submitRole === 'DEPOSIT' ? 'Tipo: depósito' : 'Tipo: destino final'}
      </p>
      {err && <p className="text-red-600 text-sm my-4">{err}</p>}
      <form
        onSubmit={submit}
        className="mt-4 max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs text-slate-600">Ramo de atividade</label>
            <select
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.activityBranchId}
              onChange={(e) => setForm({ ...form, activityBranchId: e.target.value })}
            >
              <option value="">Selecione…</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Cadastre ramos em Configurações → Ramos de atividade.
            </p>
          </div>
          <div>
            <label className="text-xs text-slate-600">CNPJ</label>
            <div className="mt-1 flex gap-2">
              <input
                required
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: formatCnpj(e.target.value) })}
                onBlur={() => void onCnpjLookup()}
                placeholder="00.000.000/0000-00"
              />
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                disabled={busy}
                onClick={() => void onCnpjLookup()}
              >
                Consultar
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-600">Código interno (opcional)</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-600">Razão social</label>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.legalName}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-600">Nome comercial</label>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.tradeName}
              onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-600">Inscrição estadual (opcional)</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.stateReg}
              onChange={(e) => setForm({ ...form, stateReg: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-600">Inscrição municipal (opcional)</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={form.municipalReg}
              onChange={(e) => setForm({ ...form, municipalReg: e.target.value })}
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">Endereço</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-600">CEP</label>
              <div className="mt-1 flex gap-2">
                <input
                  className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                  value={form.cep}
                  onChange={(e) => setForm({ ...form, cep: formatCep(e.target.value) })}
                  placeholder="00000-000"
                />
                <button
                  type="button"
                  className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                  disabled={busy}
                  onClick={() => void onCep()}
                >
                  Buscar
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-600">UF (IBGE)</label>
              <select
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={form.ufSigla}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm({ ...form, ufSigla: v, ibgeCityCode: '' });
                  if (v) void loadMunis(v);
                }}
              >
                <option value="">Selecione…</option>
                {ufs.map((u) => (
                  <option key={u.id} value={u.sigla}>
                    {u.sigla} — {u.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-600">Município (IBGE)</label>
              <select
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={form.ibgeCityCode === '' ? '' : String(form.ibgeCityCode)}
                onChange={(e) => {
                  const v = e.target.value;
                  const id = v ? parseInt(v, 10) : '';
                  const m = munis.find((x) => x.id === id);
                  setForm((f) => ({
                    ...f,
                    ibgeCityCode: id === '' ? '' : id,
                    cityName: m?.nome ?? f.cityName,
                  }));
                }}
              >
                <option value="">Selecione a UF e depois o município…</option>
                {munis.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-600">Logradouro</label>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Número</label>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Complemento</label>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={form.complement}
                onChange={(e) => setForm({ ...form, complement: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-600">Bairro</label>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-600">Endereço legado (texto livre, opcional)</label>
              <textarea
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                rows={2}
                value={form.legacyAddress}
                onChange={(e) => setForm({ ...form, legacyAddress: e.target.value })}
              />
            </div>
          </div>
        </div>

        <CnaeActivitiesTable
          receitaPayload={form.receitaPayload}
          title="Dados públicos CNPJ (BrasilAPI)"
        />

        <div className="border-t border-slate-100 pt-4 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">Responsável legal (opcional)</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs text-slate-600">Nome completo</label>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={form.legalRepFullName}
                onChange={(e) => setForm({ ...form, legalRepFullName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">CPF</label>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={form.legalRepCpf}
                onChange={(e) => setForm({ ...form, legalRepCpf: formatCpf(e.target.value) })}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">E-mail</label>
              <input
                type="email"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={form.legalRepEmail}
                onChange={(e) => setForm({ ...form, legalRepEmail: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Celular</label>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={form.legalRepPhone}
                onChange={(e) => setForm({ ...form, legalRepPhone: formatMobile(e.target.value) })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-600">
                Documento (substitui arquivo anterior se enviar novo)
              </label>
              <input
                type="file"
                className="mt-1 block w-full text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {mode === 'edit' && form.hadDoc && !file && (
                <p className="text-xs text-slate-500 mt-1">Já existe um arquivo cadastrado.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
          >
            Salvar
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
