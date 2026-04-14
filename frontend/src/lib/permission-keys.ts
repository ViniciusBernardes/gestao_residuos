/** Deve coincidir com o backend (permission-modules). */
export const PERMISSION_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'config_ramos', label: 'Ramos de atividade' },
  { key: 'config_tipos_material', label: 'Tipos de material' },
  { key: 'config_unidades', label: 'Unidades' },
  { key: 'materiais', label: 'Materiais' },
  { key: 'estabelecimentos', label: 'Estabelecimentos' },
  { key: 'integracoes', label: 'Integrações (CEP / CNPJ / IBGE)' },
  { key: 'estoque', label: 'Estoque' },
  { key: 'saidas', label: 'Saídas / destinação' },
  { key: 'usuarios', label: 'Usuários' },
  { key: 'relatorios', label: 'Relatórios' },
  { key: 'auditoria', label: 'Auditoria' },
  { key: 'admin', label: 'Administração' },
  { key: 'permissoes', label: 'Perfis de permissão' },
] as const;

export type PermissionModuleKey = (typeof PERMISSION_MODULES)[number]['key'];

export type PermissionsMatrix = Record<string, { view: boolean; edit: boolean }>;

/** Mapeia rota do app → chave de permissão (visualização). */
export const ROUTE_PERMISSION: Record<string, PermissionModuleKey> = {
  '/dashboard': 'dashboard',
  '/configuracoes/ramos-atividade': 'config_ramos',
  '/tipos-material': 'config_tipos_material',
  '/unidades': 'config_unidades',
  '/materiais': 'materiais',
  '/estabelecimentos': 'estabelecimentos',
  '/estoque': 'estoque',
  '/estoque/nova-entrada': 'estoque',
  '/saidas': 'saidas',
  '/usuarios': 'usuarios',
  '/relatorios': 'relatorios',
  '/relatorios/analitico-geral': 'relatorios',
  '/relatorios/analitico-por-deposito': 'relatorios',
  '/relatorios/estoque-geral': 'relatorios',
  '/auditoria': 'auditoria',
  '/admin': 'admin',
  '/configuracoes/perfis-permissao': 'permissoes',
  '/relatorios/vendas-classe-material': 'relatorios',
  '/relatorios/vendas-historico-mensal': 'relatorios',
};
