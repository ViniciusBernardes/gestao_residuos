'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { apiBlobAllow404, getToken, setToken } from '@/lib/api';
import { isTypingTarget } from '@/lib/is-typing-target';
import type { PermissionModuleKey } from '@/lib/permission-keys';
import { GO_FORM_ROUTES, resolveEditUrl } from '@/lib/go-shortcuts';
import {
  SHELL_NAV,
  type ShellNavEntry as NavEntry,
  type ShellNavLink as NavLink,
} from '@/lib/shell-nav';
import { canEdit, canView, refreshPermissionsFromMe } from '@/lib/permissions';

type GoRouteDest = {
  href: string;
  label: string;
  perm?: PermissionModuleKey;
  requiresEditPerm?: boolean;
};

const linkFocusClass =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900';

function linkActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === '/relatorios') return false;
  return pathname.startsWith(`${href}/`);
}

function navLinkVisible(link: Pick<NavLink, 'perm'>): boolean {
  if (!link.perm) return true;
  return canView(link.perm);
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState<string>('');
  const [permTick, setPermTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [navGroupOpen, setNavGroupOpen] = useState<Record<string, boolean>>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [coatSrc, setCoatSrc] = useState<string | null>(null);
  const coatUrlRef = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const goPendingRef = useRef(false);
  const goTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const helpOpenRef = useRef(false);
  const goRoutesRef = useRef(new Map<string, GoRouteDest>());

  helpOpenRef.current = helpOpen;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || pathname === '/login' || !getToken()) {
      if (coatUrlRef.current) {
        URL.revokeObjectURL(coatUrlRef.current);
        coatUrlRef.current = null;
      }
      setCoatSrc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const blob = await apiBlobAllow404('/tenants/current/coat-of-arms').catch(() => null);
      if (cancelled) return;
      if (coatUrlRef.current) {
        URL.revokeObjectURL(coatUrlRef.current);
        coatUrlRef.current = null;
      }
      if (!blob || blob.size === 0) {
        setCoatSrc(null);
        return;
      }
      const url = URL.createObjectURL(blob);
      coatUrlRef.current = url;
      setCoatSrc(url);
    })();
    return () => {
      cancelled = true;
      if (coatUrlRef.current) {
        URL.revokeObjectURL(coatUrlRef.current);
        coatUrlRef.current = null;
      }
    };
  }, [mounted, pathname, permTick]);

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
    return SHELL_NAV.map((entry) => {
        if (entry.type === 'link') {
          if (!navLinkVisible({ perm: entry.perm })) {
            return null;
          }
          return entry;
        }
        const items = entry.items.filter((sub) => navLinkVisible({ perm: sub.perm }));
        if (items.length === 0) return null;
        return { ...entry, items };
      })
      .filter(Boolean) as NavEntry[];
  }, [permTick, pathname]);

  const goRoutes = useMemo(() => {
    const map = new Map<string, GoRouteDest>();
    for (const entry of filteredNav) {
      if (entry.type === 'link') {
        map.set(entry.goKey.toLowerCase(), {
          href: entry.href,
          label: entry.label,
          perm: entry.perm,
          requiresEditPerm: false,
        });
      } else {
        for (const sub of entry.items) {
          map.set(sub.goKey.toLowerCase(), {
            href: sub.href,
            label: `${entry.label} › ${sub.label}`,
            perm: sub.perm,
            requiresEditPerm: false,
          });
        }
      }
    }
    for (const row of GO_FORM_ROUTES) {
      if (canEdit(row.perm)) {
        map.set(row.key, {
          href: row.href,
          label: row.label,
          perm: row.perm,
          requiresEditPerm: true,
        });
      }
    }
    return map;
  }, [filteredNav, permTick]);

  goRoutesRef.current = goRoutes;

  const shortcutRows = useMemo(() => {
    const rows: { key: string; description: string }[] = [];
    for (const entry of filteredNav) {
      if (entry.type === 'link') {
        rows.push({ key: entry.goKey.toUpperCase(), description: entry.label });
      } else {
        for (const sub of entry.items) {
          rows.push({
            key: sub.goKey.toUpperCase(),
            description: `${entry.label} › ${sub.label}`,
          });
        }
      }
    }
    for (const row of GO_FORM_ROUTES) {
      if (canEdit(row.perm)) {
        rows.push({ key: row.key, description: `Cadastrar: ${row.label}` });
      }
    }
    rows.push({
      key: 'E',
      description:
        'Editar: ficha aberta (ex.: material, saída, usuário) — só em tela de detalhe, com permissão de edição',
    });
    return rows;
  }, [filteredNav, permTick]);

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

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (helpOpen && !d.open) {
      d.showModal();
    } else if (!helpOpen && d.open) {
      d.close();
    }
  }, [helpOpen]);

  useEffect(() => {
    if (pathname === '/login' || !mounted) return;
    if (!getToken()) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (isTypingTarget(e.target)) return;

      const help = helpOpenRef.current;

      if (e.key === 'Escape' && help) {
        e.preventDefault();
        setHelpOpen(false);
        return;
      }

      if (help) {
        if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
          e.preventDefault();
          setHelpOpen(false);
        }
        return;
      }

      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
          e.preventDefault();
          setHelpOpen(true);
          return;
        }
      }

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (goPendingRef.current) {
        if (goTimerRef.current) clearTimeout(goTimerRef.current);
        const ch = e.key.length === 1 ? e.key.toLowerCase() : '';

        if (ch === 'e') {
          e.preventDefault();
          goPendingRef.current = false;
          const edit = resolveEditUrl(pathname);
          if (edit && canEdit(edit.perm)) router.push(edit.href);
          return;
        }

        if (ch && /[a-z0-9]/.test(ch)) {
          e.preventDefault();
          goPendingRef.current = false;
          const dest = goRoutesRef.current.get(ch);
          if (dest) {
            const ok = dest.requiresEditPerm
              ? canEdit(dest.perm ?? '')
              : navLinkVisible({ perm: dest.perm });
            if (ok) router.push(dest.href);
          }
          return;
        }

        goPendingRef.current = false;
        return;
      }

      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        goPendingRef.current = true;
        if (goTimerRef.current) clearTimeout(goTimerRef.current);
        goTimerRef.current = setTimeout(() => {
          goPendingRef.current = false;
        }, 1200);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [router, pathname, mounted]);

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
      <a
        href="#conteudo-principal"
        className="skip-to-content"
      >
        Pular para o conteúdo
      </a>
      <aside className="w-56 bg-brand-900 text-white flex flex-col shrink-0" aria-label="Menu principal">
        {coatSrc ? (
          <div className="px-4 pt-4 pb-2 flex justify-center border-b border-brand-700/60">
            <img
              src={coatSrc}
              alt=""
              className="max-h-[9.8rem] max-w-[min(12.6rem,100%)] object-contain drop-shadow-sm"
            />
          </div>
        ) : null}
        <div className="p-4 border-b border-brand-700">
          <div className="font-semibold text-sm">Gestão de Resíduos</div>
          <div className="text-xs text-brand-100 truncate">{userName}</div>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto" aria-label="Navegação">
          {filteredNav.map((entry) => {
            if (entry.type === 'link') {
              const active = linkActive(pathname, entry.href);
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={`block rounded px-3 py-2 text-sm ${active ? 'bg-brand-700' : 'hover:bg-brand-800'} ${linkFocusClass}`}
                  aria-current={active ? 'page' : undefined}
                  title={`Atalho: G ${entry.goKey.toUpperCase()}`}
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
                  className={`w-full flex items-center justify-between gap-2 rounded px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide transition-colors ${linkFocusClass} ${
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
                    {expanded ? '\u25BC' : '\u25B6'}
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
                            className={`block rounded px-3 py-2 text-sm ${active ? 'bg-brand-700' : 'hover:bg-brand-800'} ${linkFocusClass}`}
                            aria-current={active ? 'page' : undefined}
                            title={`Atalho: G ${sub.goKey.toUpperCase()}`}
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
          className={`m-2 mt-auto rounded bg-brand-800 px-3 py-2 text-sm hover:bg-brand-700 ${linkFocusClass}`}
        >
          Sair
        </button>
      </aside>
      <main
        id="conteudo-principal"
        tabIndex={-1}
        className="flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      >
        <div className="max-w-6xl mx-auto p-6">{children}</div>
      </main>

      <dialog
        ref={dialogRef}
        className="max-w-lg w-[calc(100%-2rem)] rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-black/40"
        onClose={() => setHelpOpen(false)}
        onCancel={(e) => {
          e.preventDefault();
          setHelpOpen(false);
        }}
        aria-labelledby="atalhos-titulo"
      >
        <div className="p-5 border-b border-slate-100">
          <h2 id="atalhos-titulo" className="text-lg font-semibold">
            Atalhos de teclado
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Use <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-mono">Tab</kbd>{' '}
            para navegar entre controles. Pressione{' '}
            <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-mono">?</kbd> para
            abrir ou fechar esta ajuda.
          </p>
        </div>
        <div className="p-5 max-h-[min(420px,55vh)] overflow-y-auto">
          <p className="text-sm text-slate-700 mb-3">
            Pressione{' '}
            <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-mono">G</kbd> e em
            seguida a tecla indicada (até ~1,2&nbsp;s): letras para telas do menu, dígitos{' '}
            <kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-mono text-xs">0</kbd>–
            <kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-mono text-xs">9</kbd> para cadastrar
            (novo), <kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-mono text-xs">E</kbd> para
            editar a ficha em que você está (detalhe de um registro).
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3 font-medium w-24">Atalho</th>
                <th className="py-2 font-medium">Destino</th>
              </tr>
            </thead>
            <tbody>
              {shortcutRows.map((row) => (
                <tr key={`${row.key}-${row.description}`} className="border-b border-slate-100">
                  <td className="py-2 pr-3 align-top">
                    <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-mono whitespace-nowrap">
                      G {row.key}
                    </kbd>
                  </td>
                  <td className="py-2 text-slate-800">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/80 rounded-b-xl">
          <form method="dialog">
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              Fechar
            </button>
          </form>
        </div>
      </dialog>
    </div>
  );
}
