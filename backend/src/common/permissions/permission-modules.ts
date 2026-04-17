/** Chaves estáveis usadas na matriz JSON e no mapeamento de rotas. */
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

export const PERMISSION_MODULE_KEYS = PERMISSION_MODULES.map((m) => m.key) as PermissionModuleKey[];

/** Chaves guardadas na matriz do perfil (integrações não são configuráveis — sempre liberadas na API). */
export const PERMISSION_MODULE_KEYS_FOR_MATRIX = PERMISSION_MODULE_KEYS.filter(
  (k) => k !== 'integracoes',
);

export type PermissionCell = { view: boolean; edit: boolean };

export type PermissionsMatrix = Record<string, PermissionCell>;

export function emptyMatrix(): PermissionsMatrix {
  const m: PermissionsMatrix = {};
  for (const k of PERMISSION_MODULE_KEYS_FOR_MATRIX) {
    m[k] = { view: false, edit: false };
  }
  return m;
}

export function fullMatrix(): PermissionsMatrix {
  const m: PermissionsMatrix = {};
  for (const k of PERMISSION_MODULE_KEYS_FOR_MATRIX) {
    m[k] = { view: true, edit: true };
  }
  return m;
}

/** Operador sem perfil customizado: mesmo recorte que a API já permitia via @Roles. */
export function operatorDefaultMatrix(): PermissionsMatrix {
  const m = emptyMatrix();
  const viewOnly: PermissionModuleKey[] = ['dashboard', 'materiais', 'estabelecimentos', 'relatorios'];
  const viewEdit: PermissionModuleKey[] = ['estoque', 'saidas'];
  for (const k of viewOnly) m[k] = { view: true, edit: false };
  for (const k of viewEdit) m[k] = { view: true, edit: true };
  return m;
}
