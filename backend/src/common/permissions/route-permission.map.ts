import { PermissionModuleKey } from './permission-modules';

export type PermissionLevel = 'view' | 'edit';

/** Resolve módulo e nível a partir do método HTTP e do path (com ou sem prefixo /api). */
export function resolveRoutePermission(
  method: string,
  url: string,
): { key: PermissionModuleKey; level: PermissionLevel } | null {
  /** Sem barra inicial — deve bater com os prefixos das regras (ex.: `activity-branches`, não `/activity-branches`). */
  const path = (url.split('?')[0] || '')
    .replace(/^\/api\/?/i, '')
    .replace(/^\//, '')
    .replace(/\/$/, '');

  const m = method.toUpperCase();
  const level: PermissionLevel = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m) ? 'edit' : 'view';

  const rules: { prefix: string; key: PermissionModuleKey }[] = [
    { prefix: 'permission-profiles', key: 'permissoes' },
    { prefix: 'users', key: 'usuarios' },
    { prefix: 'activity-branches', key: 'config_ramos' },
    { prefix: 'material-types', key: 'config_tipos_material' },
    { prefix: 'units', key: 'config_unidades' },
    { prefix: 'materials', key: 'materiais' },
    { prefix: 'establishments', key: 'estabelecimentos' },
    { prefix: 'integrations', key: 'integracoes' },
    { prefix: 'stock', key: 'estoque' },
    { prefix: 'exits', key: 'saidas' },
    /** Dashboard da home: alinhado ao módulo «dashboard» do menu, não a «relatórios». */
    { prefix: 'reports/dashboard', key: 'dashboard' },
    { prefix: 'reports', key: 'relatorios' },
    { prefix: 'audit', key: 'auditoria' },
    { prefix: 'admin', key: 'admin' },
    { prefix: 'backup', key: 'admin' },
    { prefix: 'import', key: 'materiais' },
    { prefix: 'tracking', key: 'materiais' },
    { prefix: 'tenants', key: 'admin' },
  ];

  for (const { prefix, key } of rules) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return { key, level };
    }
  }

  return null;
}
