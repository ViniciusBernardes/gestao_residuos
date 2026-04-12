'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, apiBlob, getToken } from '@/lib/api';
import { formatCep, formatCnpj, formatCpf, formatMobile } from '@/lib/masks';
import { canEdit } from '@/lib/permissions';
import { CnaeActivitiesTable } from '@/components/CnaeActivitiesTable';

type EstRole = 'DEPOSIT' | 'DESTINATION';

type Row = {
  id: string;
  role: EstRole;
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
  receitaPayload: Record<string, unknown> | null;
  legalRepFullName: string | null;
  legalRepCpf: string | null;
  legalRepEmail: string | null;
  legalRepPhone: string | null;
  legalRepDocPath: string | null;
  code: string | null;
  legacyAddress: string | null;
  active: boolean;
  activityBranch: { id: string; name: string; role: EstRole };
};

export default function EstabelecimentoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api<Row>(`/establishments/${id}`)
      .then(setRow)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [id, router]);

  async function downloadDoc() {
    setErr('');
    try {
      const blob = await apiBlob(`/establishments/${id}/legal-document`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = row?.legalRepDocPath ?? 'documento';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao baixar');
    }
  }

  if (!getToken()) return null;
  const canEditEst = canEdit('estabelecimentos');

  if (err && !row) return <p className="text-red-600 text-sm">{err}</p>;
  if (!row) return <p className="text-slate-600 text-sm">Carregando…</p>;

  const back = `/estabelecimentos?role=${row.role}`;

  return (
    <div>
      <Link href={back} className="text-sm text-brand-700 hover:underline">
        ← {row.role === 'DEPOSIT' ? 'Depósitos' : 'Destino final'}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{row.tradeName}</h1>
          <p className="text-slate-600 text-sm">{row.legalName}</p>
        </div>
        {canEditEst && (
          <Link
            href={`/estabelecimentos/${id}/editar?role=${row.role}`}
            className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
          >
            Editar
          </Link>
        )}
      </div>
      {err && <p className="text-red-600 text-sm my-4">{err}</p>}

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 text-sm max-w-3xl">
        <div>
          <dt className="text-slate-500">Tipo</dt>
          <dd className="font-medium">{row.role === 'DEPOSIT' ? 'Depósito' : 'Destino final'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Ramo de atividade</dt>
          <dd className="font-medium">{row.activityBranch.name}</dd>
        </div>
        <div>
          <dt className="text-slate-500">CNPJ</dt>
          <dd className="font-medium">{row.cnpj ? formatCnpj(row.cnpj) : '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Código</dt>
          <dd className="font-medium">{row.code ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Inscrição estadual</dt>
          <dd className="font-medium">{row.stateReg ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Inscrição municipal</dt>
          <dd className="font-medium">{row.municipalReg ?? '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Endereço</dt>
          <dd className="font-medium">
            {[row.street, row.number, row.complement, row.district].filter(Boolean).join(', ') ||
              '—'}
            <br />
            {row.cityName || row.ibgeCityCode
              ? `${row.cityName ?? ''}${row.ufSigla ? ` — ${row.ufSigla}` : ''} (IBGE: ${row.ibgeCityCode ?? '—'})`
              : null}
            {row.cep && (
              <>
                <br />
                CEP {formatCep(row.cep)}
              </>
            )}
            {row.legacyAddress && (
              <>
                <br />
                <span className="text-slate-600">Legado: {row.legacyAddress}</span>
              </>
            )}
          </dd>
        </div>
        {row.receitaPayload && (
          <div className="sm:col-span-2">
            <CnaeActivitiesTable
              receitaPayload={row.receitaPayload}
              title="Atividades (dados públicos CNPJ)"
            />
          </div>
        )}
        <div>
          <dt className="text-slate-500">Ativo</dt>
          <dd className="font-medium">{row.active ? 'Sim' : 'Não'}</dd>
        </div>
      </dl>

      <div className="mt-8 border-t border-slate-200 pt-6 max-w-3xl">
        <h2 className="text-sm font-semibold text-slate-800">Responsável legal</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-slate-500">Nome</dt>
            <dd>{row.legalRepFullName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">CPF</dt>
            <dd>{row.legalRepCpf ? formatCpf(row.legalRepCpf) : '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">E-mail</dt>
            <dd>{row.legalRepEmail ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Celular</dt>
            <dd>{row.legalRepPhone ? formatMobile(row.legalRepPhone) : '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Documento anexado</dt>
            <dd>
              {row.legalRepDocPath ? (
                <button
                  type="button"
                  className="text-brand-700 hover:underline"
                  onClick={() => void downloadDoc()}
                >
                  Baixar arquivo
                </button>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
