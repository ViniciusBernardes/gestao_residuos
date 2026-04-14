'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { getToken, setToken } from '@/lib/api';
import type { PermissionModuleKey } from '@/lib/permission-keys';
import { canView, refreshPermissionsFromMe } from '@/lib/permissions';

type NavLink = { href: string; label: string; perm?: PermissionModuleKey };

type NavEntry =
  | { type: 'link'; href: string; label: string; perm?: PermissionModuleKey }
  | { type: 'group'; label: string; items: NavLink[] };

const nav: NavEntry[] = [
  { type: 'link', href: '/dashboard', label: 'Dashboard', perm: 'dashboard' },
  
  { type: 'link', href: '/materiais', label: 'Materiais', perm: 'materiais' },
  { type: 'link', href: '/estabelecimentos', label: 'Depósito/Destino Final', perm: 'estabelecimentos' },
  { type: 'link', href: '/estoque', label: 'Estoque', perm: 'estoque' },
  { type: 'link', href: '/saidas', label: 'Saídas', perm: 'saidas' },
  { type: 'link', href: '/usuarios', label: 'Usuários', perm: 'usuarios' },
  {
    type: 'group',
    label: 'Relatórios',
    items: [
      /*{ href: '/relatorios', label: 'Downloads', perm: 'relatorios' },*/
      {
        href: '/relatorios/analitico-geral',
        label: 'Geral',
        perm: 'relatorios',
      },
      {
        href: '/relatorios/analitico-por-deposito',
        label: 'Por Depósito',
        perm: 'relatorios',
      },
      {
        href: '/relatorios/estoque-geral',
        label: 'Materiais em Estoque',
        perm: 'relatorios',
      },
      {
        href: '/relatorios/vendas-classe-material',
        label: 'Gráficos vendas',
        perm: 'relatorios',
      },
      {
        href: '/relatorios/vendas-historico-mensal',
        label: 'Histórico mensal vendas',
        perm: 'relatorios',
      },
    ],
  },
  { type: 'link', href: '/auditoria', label: 'Auditoria', perm: 'auditoria' },
  { type: 'link', href: '/admin', label: 'Administração', perm: 'admin' },
  {
    type: 'group',
    label: 'Configurações',
    items: [
      { href: '/configuracoes/ramos-atividade', label: 'Ramos de atividade', perm: 'config_ramos' },
      { href: '/tipos-material', label: 'Tipos de material', perm: 'config_tipos_material' },
      { href: '/unidades', label: 'Unidades', perm: 'config_unidades' },
      {
        href: '/configuracoes/perfis-permissao',
        label: 'Perfis de permissão',
        perm: 'permissoes',
      },
    ],
  },
];

function linkActive(pathname: string, href: string) {
  if (pathname === href) return true;
  /** Evita marcar "Downloads" ao estar em /relatorios/… */
  if (href === '/relatorios') return false;
  return pathname.startsWith(`${href}/`);
}

function navLinkVisible(link: NavLink): boolean {
  if (!link.perm) return true;
  return canView(link.perm);
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState<string>('');
  const [permTick, setPermTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  /** Aberto/fechado por grupo; ao entrar numa rota filha o efeito limpa a chave para reabrir o grupo. */
  const [navGroupOpen, setNavGroupOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!getToken()) return;
    if (pathname === '/login') return;
    refreshPermissionsFromMe().finally(() => setPermTick((t) => t + 1));
  }, [mounted, pathname]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw) as { name?: string };
        setUserName(u.name ?? '');
      } else {
        setUserName('');
      }
    } catch {
      setUserName('');
    }
  }, [mounted, pathname, permTick]);

  const filteredNav = useMemo(() => {
    void permTick;
    return nav
      .map((entry) => {
        if (entry.type === 'link') {
          if (!navLinkVisible({ href: entry.href, label: entry.label, perm: entry.perm })) {
            return null;
          }
          return entry;
        }
        const items = entry.items.filter((sub) =>
          navLinkVisible({ href: sub.href, label: sub.label, perm: sub.perm }),
        );
        if (items.length === 0) return null;
        return { ...entry, items };
      })
      .filter(Boolean) as NavEntry[];
  }, [permTick, pathname]);

  useEffect(() => {
    setNavGroupOpen((prev) => {
      const next = { ...prev };
      for (const entry of filteredNav) {
        if (entry.type !== 'group') continue;
        if (entry.items.some((sub) => linkActive(pathname, sub.href))) {
          delete next[entry.label];
        }
      }
      return next;
    });
  }, [pathname, filteredNav]);

  function logout() {
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('tenantSlug');
    router.push('/login');
  }

  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (!mounted) {
    return <>{children}</>;
  }

  if (!getToken()) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-56 bg-brand-900 text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-brand-700">
          <div className="font-semibold text-sm">Gestão de Resíduos</div>
          <div className="text-xs text-brand-100 truncate">{userName}</div>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {filteredNav.map((entry) => {
            if (entry.type === 'link') {
              const active = linkActive(pathname, entry.href);
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={`block rounded px-3 py-2 text-sm ${
                    active ? 'bg-brand-700' : 'hover:bg-brand-800'
                  }`}
                >
                  {entry.label}
                </Link>
              );
            }
            const groupHasActive = entry.items.some((sub) => linkActive(pathname, sub.href));
            const expanded = groupHasActive
              ? navGroupOpen[entry.label] !== false
              : Boolean(navGroupOpen[entry.label]);
            return (
              <div key={entry.label} className="pt-1">
                <button
                  type="button"
                  className={`w-full flex items-center justify-between gap-2 rounded px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide transition-colors ${
                    groupHasActive ? 'text-brand-100' : 'text-brand-300/90'
                  } hover:bg-brand-800/60`}
                  aria-expanded={expanded}
                  onClick={() => {
                    setNavGroupOpen((prev) => {
                      const hasActive = entry.items.some((sub) => linkActive(pathname, sub.href));
                      const now = hasActive ? prev[entry.label] !== false : Boolean(prev[entry.label]);
                      return { ...prev, [entry.label]: !now };
                    });
                  }}
                >
                  <span>{entry.label}</span>
                  <span className="text-[10px] opacity-80 shrink-0" aria-hidden>
                    {expanded ? '▼' : '▶'}
                  </span>
                </button>
                {expanded ? (
                  <ul className="space-y-0.5 border-l border-brand-700/80 ml-3 pl-2 mt-0.5">
                    {entry.items.map((sub) => {
                      const active = linkActive(pathname, sub.href);
                      return (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            className={`block rounded px-3 py-2 text-sm ${
                              active ? 'bg-brand-700' : 'hover:bg-brand-800'
                            }`}
                          >
                            {sub.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={logout}
          className="m-2 mt-auto rounded bg-brand-800 px-3 py-2 text-sm hover:bg-brand-700"
        >
          Sair
        </button>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
