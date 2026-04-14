const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/** Limpa credenciais e envia ao login (evita loop na própria página de login). */
export function clearSessionAndRedirectToLogin(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  const path = window.location.pathname;
  if (path === '/login' || path.startsWith('/login/')) return;
  window.location.assign('/login');
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null; skipAuthRedirect?: boolean } = {},
): Promise<T> {
  const { skipAuthRedirect, token: tokenOpt, ...fetchInit } = options;
  const token = tokenOpt ?? getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(fetchInit.headers ?? {}),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchInit,
    headers,
  });

  if (res.status === 401 && !skipAuthRedirect) {
    clearSessionAndRedirectToLogin();
  }

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.message ?? JSON.stringify(j);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type');
  if (ct?.includes('application/json')) return res.json() as Promise<T>;
  return res.text() as unknown as T;
}

/** Upload multipart (sem Content-Type JSON). */
export async function apiUpload<T>(
  path: string,
  file: File,
  opts?: { skipAuthRedirect?: boolean },
): Promise<T> {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  const headers: HeadersInit = {};
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: form });
  if (res.status === 401 && !opts?.skipAuthRedirect) {
    clearSessionAndRedirectToLogin();
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.message ?? JSON.stringify(j);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type');
  if (ct?.includes('application/json')) return res.json() as Promise<T>;
  return res.text() as unknown as T;
}

/** GET binário com Bearer (ex.: download de documento). */
export async function apiBlob(path: string, opts?: { skipAuthRedirect?: boolean }): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 && !opts?.skipAuthRedirect) {
    clearSessionAndRedirectToLogin();
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.message ?? JSON.stringify(j);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
   return res.blob();
}

/** POST que retorna binário (ex.: download de backup). */
export async function apiBlobPost(
  path: string,
  body: Record<string, unknown> = {},
  opts?: { skipAuthRedirect?: boolean },
): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401 && !opts?.skipAuthRedirect) {
    clearSessionAndRedirectToLogin();
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.message ?? JSON.stringify(j);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.blob();
}

export { API_BASE };
