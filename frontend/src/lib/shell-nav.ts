import type { PermissionModuleKey } from '@/lib/permission-keys';

export type ShellNavLink = {
  href: string;
  label: string;
  perm?: PermissionModuleKey;
  goKey: string;
};

export type ShellNavEntry =
  | { type: 'link'; href: string; label: string; perm?: PermissionModuleKey; goKey: string }
  | { type: 'group'; label: string; items: ShellNavLink[] };

/** Fonte única do menu lateral e dos atalhos G + tecla. */
export const SHELL_NAV: ShellNavEntry[] = [
  { type: 'link', href: '/dashboard', label: 'Dashboard', perm: 'dashboard', goKey: 'd' },
  { type: 'link', href: '/materiais', label: 'Materiais', perm: 'materiais', goKey: 'm' },
  {
    type: 'link',
    href: '/estabelecimentos',
    label: 'Depósito/Destino Final',
    perm: 'estabelecimentos',
    goKey: 'b',
  },
  { type: 'link', href: '/estoque', label: 'Estoque', perm: 'estoque', goKey: 'o' },
  { type: 'link', href: '/saidas', label: 'Saídas', perm: 'saidas', goKey: 'i' },
  { type: 'link', href: '/usuarios', label: 'Usuários', perm: 'usuarios', goKey: 'u' },
  {
    type: 'group',
    label: 'Relatórios',
    items: [
      {
        href: '/relatorios/analitico-geral',
        label: 'Geral',
        perm: 'relatorios',
        goKey: 'r',
      },
      {
        href: '/relatorios/analitico-por-deposito',
        label: 'Por Depósito',
        perm: 'relatorios',
        goKey: 'p',
      },
      {
        href: '/relatorios/estoque-geral',
        label: 'Materiais em Estoque',
        perm: 'relatorios',
        goKey: 'w',
      },
      {
        href: '/relatorios/vendas-classe-material',
        label: 'Gráficos vendas',
        perm: 'relatorios',
        goKey: 'v',
      },
      {
        href: '/relatorios/vendas-historico-mensal',
        label: 'Histórico mensal vendas',
        perm: 'relatorios',
        goKey: 'h',
      },
    ],
  },
  { type: 'link', href: '/auditoria', label: 'Auditoria', perm: 'auditoria', goKey: 't' },
  { type: 'link', href: '/admin', label: 'Administração', perm: 'admin', goKey: 'n' },
  {
    type: 'group',
    label: 'Configurações',
    items: [
      {
        href: '/configuracoes/ramos-atividade',
        label: 'Ramos de atividade',
        perm: 'config_ramos',
        goKey: 'c',
      },
      { href: '/tipos-material', label: 'Tipos de material', perm: 'config_tipos_material', goKey: 'y' },
      { href: '/unidades', label: 'Unidades', perm: 'config_unidades', goKey: 'z' },
      {
        href: '/configuracoes/perfis-permissao',
        label: 'Perfis de permissão',
        perm: 'permissoes',
        goKey: 'f',
      },
      {
        href: '/configuracoes/atalhos',
        label: 'Atalhos de teclado',
        goKey: 'k',
      },
    ],
  },
];
