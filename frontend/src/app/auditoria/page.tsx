'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PaginationBar } from '@/components/PaginationBar';
import { getToken } from '@/lib/api';
import { fetchPaginated } from '@/lib/paginated-api';
import { readUserFullAccess } from '@/lib/access';
import { canView } from '@/lib/permissions';
import { formatAuditAction, getAuditResourcePresentation } from '@/lib/audit-resource-labels';
import { auditDetailsRawJson, formatAuditDetailsLines } from '@/lib/format-audit-details';
import { PAGE_SIZE } from '@/lib/types';

type AuditActionRow = {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string } | null;
};

type LoginAuditRow = {
  id: string;
  email: string | null;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  reason: string | null;
  createdAt: string;
};

export default function AuditoriaPage() {
  const router = useRouter();
  const canActions = canView('auditoria');
  const canLogins = readUserFullAccess();

  const [tab, setTab] = useState<'actions' | 'logins'>('actions');
  const [actPage, setActPage] = useState(1);
  const [loginPage, setLoginPage] = useState(1);
  const [actionsData, setActionsData] = useState({
    items: [] as AuditActionRow[],
    total: 0,
    totalPages: 1,
    limit: PAGE_SIZE,
  });
  const [loginsData, setLoginsData] = useState({
    items: [] as LoginAuditRow[],
    total: 0,
    totalPages: 1,
    limit: PAGE_SIZE,
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const loadActions = useCallback(() => {
    if (!getToken() || !canActions) return;
    setLoading(true);
    setErr('');
    fetchPaginated<AuditActionRow>('/audit/actions', actPage, PAGE_SIZE)
      .then((r) =>
        setActionsData({
          items: r.items,
          total: r.total,
          totalPages: r.totalPages,
          limit: r.limit,
        }),
      )
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [actPage, canActions]);

  const loadLogins = useCallback(() => {
    if (!getToken() || !canLogins) return;
    setLoading(true);
    setErr('');
    fetchPaginated<LoginAuditRow>('/audit/logins', loginPage, PAGE_SIZE)
      .then((r) =>
        setLoginsData({
          items: r.items,
          total: r.total,
          totalPages: r.totalPages,
          limit: r.limit,
        }),
      )
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [loginPage, canLogins]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!canActions && !canLogins) {
      setErr('Sem permissão. Auditoria de ações: administrador ou gestor. Logins: apenas administrador.');
      setLoading(false);
      return;
    }
    if (tab === 'actions') loadActions();
    else loadLogins();
  }, [router, tab, loadActions, loadLogins, canActions, canLogins]);

  useEffect(() => {
    if (tab === 'logins' && !canLogins) setTab('actions');
  }, [tab, canLogins]);

  if (!getToken()) return null;

  if (!canActions && !canLogins) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Auditoria</h1>
        <p className="text-red-600">{err}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Auditoria</h1>
      <p className="text-slate-600 text-sm mb-6">
        Registros paginados do tenant (ações no sistema e tentativas de login).
      </p>

      <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-200 pb-3">
        {canActions && (
          <button
            type="button"
            onClick={() => {
              setTab('actions');
              setActPage(1);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === 'actions'
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Ações no sistema
          </button>
        )}
        {canLogins && (
          <button
            type="button"
            onClick={() => {
              setTab('logins');
              setLoginPage(1);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === 'logins'
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Logins
          </button>
        )}
      </div>

      {err && <p className="text-red-600 text-sm mb-4">{err}</p>}

      {tab === 'actions' && canActions && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Data</th>
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium min-w-[200px]">
                    <span className="block">Recurso</span>
                    <span className="block text-[11px] font-normal text-slate-500 normal-case">
                      (como no menu)
                    </span>
                  </th>
                  <th className="px-4 py-3 font-medium">Ação</th>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium min-w-[220px] max-w-md">
                    <span className="block">Detalhes</span>
                    <span className="block text-[11px] font-normal text-slate-500 normal-case">
                      (passe o mouse para o JSON)
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Carregando…
                    </td>
                  </tr>
                ) : (
                  actionsData.items.map((r) => {
                    const res = getAuditResourcePresentation(r.resource);
                    const detailLines = formatAuditDetailsLines(r.details, { resource: r.resource });
                    const detailJson = auditDetailsRawJson(r.details);
                    return (
                    <tr key={r.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {new Date(r.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.user ? (
                          <>
                            <span className="font-medium">{r.user.name}</span>
                            <br />
                            <span className="text-xs text-slate-500">{r.user.email}</span>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3" title={`Recurso técnico: ${res.raw}`}>
                        <div className="font-medium text-slate-800">{res.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5 leading-snug">{res.menu}</div>
                      </td>
                      <td
                        className="px-4 py-3 text-slate-800"
                        title={r.action}
                      >
                        {formatAuditAction(r.action)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {r.resourceId ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-md align-top">
                        {detailLines.length === 0 && r.details == null ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <div className="space-y-1.5" title={detailJson || undefined}>
                            {detailLines.map((line, i) => (
                              <p key={i} className="text-xs leading-snug text-slate-700">
                                {line}
                              </p>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={actPage}
            totalPages={actionsData.totalPages}
            total={actionsData.total}
            limit={actionsData.limit}
            onPageChange={setActPage}
          />
        </div>
      )}

      {tab === 'logins' && canLogins && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Data</th>
                  <th className="px-4 py-3 font-medium">E-mail</th>
                  <th className="px-4 py-3 font-medium">Resultado</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Carregando…
                    </td>
                  </tr>
                ) : (
                  loginsData.items.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3">{r.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            r.success
                              ? 'text-emerald-700 font-medium'
                              : 'text-red-600 font-medium'
                          }
                        >
                          {r.success ? 'Sucesso' : 'Falha'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{r.ip ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{r.reason ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={loginPage}
            totalPages={loginsData.totalPages}
            total={loginsData.total}
            limit={loginsData.limit}
            onPageChange={setLoginPage}
          />
        </div>
      )}
    </div>
  );
}
