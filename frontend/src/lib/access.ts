/** Indica perfil com acesso total (equivalente ao antigo “administrador” de sistema). */
export function readUserFullAccess(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { fullAccess?: boolean };
    return u.fullAccess === true;
  } catch {
    return false;
  }
}
