import type { PermissionModuleKey } from '@/lib/permission-keys';

/** Rotas de cadastro (novo) acessíveis com G + dígito (requer permissão de edição no módulo). */
export const GO_FORM_ROUTES: {
  key: string;
  href: string;
  label: string;
  perm: PermissionModuleKey;
}[] = [
  { key: '1', href: '/materiais/novo', label: 'Cadastrar material', perm: 'materiais' },
  { key: '2', href: '/estabelecimentos/novo', label: 'Cadastrar depósito / destino', perm: 'estabelecimentos' },
  { key: '3', href: '/saidas/novo', label: 'Cadastrar saída', perm: 'saidas' },
  { key: '4', href: '/usuarios/novo', label: 'Cadastrar usuário', perm: 'usuarios' },
  { key: '5', href: '/estoque/nova-entrada', label: 'Nova entrada de estoque (coleta)', perm: 'estoque' },
  { key: '6', href: '/tipos-material/novo', label: 'Cadastrar tipo de material', perm: 'config_tipos_material' },
  { key: '7', href: '/unidades/novo', label: 'Cadastrar unidade de medida', perm: 'config_unidades' },
  { key: '8', href: '/configuracoes/ramos-atividade/novo', label: 'Cadastrar ramo de atividade', perm: 'config_ramos' },
  { key: '9', href: '/configuracoes/perfis-permissao/novo', label: 'Cadastrar perfil de permissão', perm: 'permissoes' },
  { key: '0', href: '/admin/novo', label: 'Cadastrar município (tenant)', perm: 'admin' },
];

/**
 * A partir da URL atual de uma ficha (detalhe), devolve a rota de edição.
 * Não aplica em /novo, /editar ou listagens.
 */
export function resolveEditUrl(pathname: string): { href: string; perm: PermissionModuleKey } | null {
  if (!pathname || pathname.includes('/editar')) return null;

  const rules: { test: RegExp; perm: PermissionModuleKey; href: (m: RegExpMatchArray) => string }[] = [
    {
      test: /^\/materiais\/([^/]+)$/,
      perm: 'materiais',
      href: (m) => `/materiais/${m[1]}/editar`,
    },
    {
      test: /^\/estabelecimentos\/([^/]+)$/,
      perm: 'estabelecimentos',
      href: (m) => `/estabelecimentos/${m[1]}/editar`,
    },
    {
      test: /^\/saidas\/([^/]+)$/,
      perm: 'saidas',
      href: (m) => `/saidas/${m[1]}/editar`,
    },
    {
      test: /^\/usuarios\/([^/]+)$/,
      perm: 'usuarios',
      href: (m) => `/usuarios/${m[1]}/editar`,
    },
    {
      test: /^\/tipos-material\/([^/]+)$/,
      perm: 'config_tipos_material',
      href: (m) => `/tipos-material/${m[1]}/editar`,
    },
    {
      test: /^\/unidades\/([^/]+)$/,
      perm: 'config_unidades',
      href: (m) => `/unidades/${m[1]}/editar`,
    },
    {
      test: /^\/configuracoes\/ramos-atividade\/([^/]+)$/,
      perm: 'config_ramos',
      href: (m) => `/configuracoes/ramos-atividade/${m[1]}/editar`,
    },
    {
      test: /^\/configuracoes\/perfis-permissao\/([^/]+)$/,
      perm: 'permissoes',
      href: (m) => `/configuracoes/perfis-permissao/${m[1]}/editar`,
    },
    {
      test: /^\/admin\/([^/]+)$/,
      perm: 'admin',
      href: (m) => `/admin/${m[1]}/editar`,
    },
  ];

  for (const rule of rules) {
    const m = pathname.match(rule.test);
    if (!m) continue;
    const id = m[1];
    if (!id || id === 'novo') continue;
    return { href: rule.href(m), perm: rule.perm };
  }

  return null;
}
