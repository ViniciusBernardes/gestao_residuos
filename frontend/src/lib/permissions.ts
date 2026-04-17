import { api, getToken } from './api';
import { readUserFullAccess } from './access';
import { ROUTE_PERMISSION, type PermissionsMatrix } from './permission-keys';

type StoredUser = {
  name?: string;
  email?: string;
  fullAccess?: boolean;
  permissions?: PermissionsMatrix;
  permissionProfileId?: string | null;
};

function parseStoredUser(): StoredUser {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('user') ?? '{}') as StoredUser;
  } catch {
    return {};
  }
}

export function readPermissionsMatrix(): PermissionsMatrix | null {
  const u = parseStoredUser();
  return u.permissions ?? null;
}

/** Visualizar menu / página (leitura). Acesso total ignora matriz. Demais: só o que estiver explícito com view. */
export function canView(moduleKey: string): boolean {
  if (moduleKey === 'integracoes') return true;
  if (readUserFullAccess()) return true;
  const m = readPermissionsMatrix();
  if (!m) return false;
  return !!m[moduleKey]?.view;
}

/** Incluir / alterar / excluir dados do módulo. */
export function canEdit(moduleKey: string): boolean {
  if (moduleKey === 'integracoes') return true;
  if (readUserFullAccess()) return true;
  const m = readPermissionsMatrix();
  if (!m) return false;
  return !!m[moduleKey]?.edit;
}

export function canAccessRoute(href: string): boolean {
  const key = ROUTE_PERMISSION[href];
  if (!key) return true;
  return canView(key);
}

/** Sincroniza permissões após login ou ao abrir o app (JWT ainda válido). */
export async function refreshPermissionsFromMe(): Promise<void> {
  if (!getToken()) return;
  try {
    const me = await api<{
      permissions: PermissionsMatrix;
      permissionProfileId: string | null;
      fullAccess: boolean;
    }>('/users/me');
    const raw = localStorage.getItem('user');
    if (!raw) return;
    const u = JSON.parse(raw) as StoredUser;
    u.permissions = me.permissions;
    u.permissionProfileId = me.permissionProfileId;
    u.fullAccess = me.fullAccess;
    localStorage.setItem('user', JSON.stringify(u));
  } catch {
    /* ignore */
  }
}
