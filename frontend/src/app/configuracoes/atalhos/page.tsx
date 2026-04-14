'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getToken } from '@/lib/api';
import { GO_FORM_ROUTES } from '@/lib/go-shortcuts';
import { PERMISSION_MODULES, type PermissionModuleKey } from '@/lib/permission-keys';
import { canEdit, canView, refreshPermissionsFromMe } from '@/lib/permissions';
import { SHELL_NAV, type ShellNavEntry } from '@/lib/shell-nav';

function moduleLabel(key: PermissionModuleKey): string {
  return PERMISSION_MODULES.find((m) => m.key === key)?.label ?? key;
}

function filterNav(entries: typeof SHELL_NAV, tick: number): ShellNavEntry[] {
  void tick;
  return entries
    .map((entry) => {
      if (entry.type === 'link') {
        if (entry.perm && !canView(entry.perm)) return null;
        return entry;
      }
      const items = entry.items.filter((sub) => !sub.perm || canView(sub.perm));
      if (items.length === 0) return null;
      return { ...entry, items };
    })
    .filter(Boolean) as ShellNavEntry[];
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-mono">{children}</kbd>
  );
}

export default function AtalhosTecladoPage() {
  const router = useRouter();
  const [permTick, setPermTick] = useState(0);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    refreshPermissionsFromMe().finally(() => setPermTick((t) => t + 1));
  }, [router]);

  const filteredNav = useMemo(() => filterNav(SHELL_NAV, permTick), [permTick]);

  const menuRows = useMemo(() => {
    const rows: { shortcut: string; label: string; href: string }[] = [];
    for (const entry of filteredNav) {
      if (entry.type === 'link') {
        rows.push({
          shortcut: `G ${entry.goKey.toUpperCase()}`,
          label: entry.label,
          href: entry.href,
        });
      } else {
        for (const sub of entry.items) {
          rows.push({
            shortcut: `G ${sub.goKey.toUpperCase()}`,
            label: `${entry.label} › ${sub.label}`,
            href: sub.href,
          });
        }
      }
    }
    return rows;
  }, [filteredNav]);

  const cadastroRows = useMemo(
    () =>
      GO_FORM_ROUTES.map((r) => ({
        digit: r.key,
        label: r.label,
        href: r.href,
        perm: r.perm,
        podeUsar: canEdit(r.perm),
      })),
    [permTick],
  );

  if (!getToken()) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Atalhos de teclado</h1>
        <p className="text-slate-600 text-sm max-w-3xl">
          Lista completa dos atalhos globais (fora de campos de texto). Pressione <Kbd>?</Kbd> em qualquer tela para
          abrir a mesma referência em um diálogo rápido.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Como usar</h2>
        </div>
        <ul className="px-4 py-4 text-sm text-slate-700 space-y-2 list-disc list-inside">
          <li>
            <Kbd>Tab</Kbd> e <Kbd>Shift</Kbd> + <Kbd>Tab</Kbd> — navegar entre links, botões e campos.
          </li>
          <li>
            Primeiro foco ao carregar: use o link <strong>Pular para o conteúdo</strong> (<Kbd>Tab</Kbd> no início da
            página).
          </li>
          <li>
            <Kbd>G</Kbd> e, em seguida, uma letra ou dígito (até ~1,2&nbsp;s) — ir para a tela indicada na tabela abaixo.
          </li>
          <li>
            <Kbd>?</Kbd> ou <Kbd>Shift</Kbd> + <Kbd>/</Kbd> — abrir ou fechar o diálogo de ajuda.
          </li>
          <li>
            <Kbd>Esc</Kbd> — fechar o diálogo de ajuda; em alguns modais (ex.: estoque), fechar sem salvar.
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Navegação (menu)</h2>
          <p className="text-xs text-slate-500 mt-1">Atalhos que aparecem no menu conforme seu perfil de permissões.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium w-28">Atalho</th>
                <th className="px-4 py-3 font-medium">Destino</th>
                <th className="px-4 py-3 font-medium w-32">Link</th>
              </tr>
            </thead>
            <tbody>
              {menuRows.map((row) => (
                <tr key={`${row.shortcut}-${row.href}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <Kbd>
                      G + {row.shortcut.startsWith('G ') ? row.shortcut.slice(2) : row.shortcut}
                    </Kbd>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{row.label}</td>
                  <td className="px-4 py-3">
                    <Link href={row.href} className="text-brand-700 hover:underline font-medium">
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Cadastrar (novo registro)</h2>
          <p className="text-xs text-slate-500 mt-1">
            Exige permissão de <strong>edição</strong> no módulo indicado; caso contrário o atalho não navega.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium w-28">Atalho</th>
                <th className="px-4 py-3 font-medium">Destino</th>
                <th className="px-4 py-3 font-medium">Módulo (edição)</th>
                <th className="px-4 py-3 font-medium w-28">Seu acesso</th>
                <th className="px-4 py-3 font-medium w-24">Link</th>
              </tr>
            </thead>
            <tbody>
              {cadastroRows.map((row) => (
                <tr key={row.href} className="border-t border-slate-100">
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <Kbd>
                      G {row.digit}
                    </Kbd>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{row.label}</td>
                  <td className="px-4 py-3 text-slate-600">{moduleLabel(row.perm)}</td>
                  <td className="px-4 py-3">
                    {row.podeUsar ? (
                      <span className="text-emerald-700 font-medium">Ativo</span>
                    ) : (
                      <span className="text-slate-400">Sem edição</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={row.href} className="text-brand-700 hover:underline font-medium">
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Editar ficha atual</h2>
        </div>
        <div className="px-4 py-4 text-sm text-slate-700 space-y-2">
          <p>
            Na tela de <strong>detalhe</strong> de um registro (ex.: <code className="text-xs bg-slate-100 px-1 rounded">/materiais/[id]</code>
            ), pressione <Kbd>G</Kbd> e em seguida <Kbd>E</Kbd> para abrir a edição, se tiver permissão de edição naquele
            módulo.
          </p>
          <p className="text-slate-500 text-xs">
            Não se aplica em listagens, em <code className="bg-slate-100 px-1 rounded">/novo</code> nem em telas que já
            estão em <code className="bg-slate-100 px-1 rounded">/editar</code>.
          </p>
        </div>
      </section>
    </div>
  );
}
