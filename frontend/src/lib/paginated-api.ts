import { api } from './api';
import type { Paginated } from './types';

export async function fetchPaginated<T>(
  path: string,
  page: number,
  limit: number,
): Promise<Paginated<T>> {
  const q = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const sep = path.includes('?') ? '&' : '?';
  return api<Paginated<T>>(`${path}${sep}${q.toString()}`);
}

/** Para selects em formulários (primeira página com limite alto). */
export async function fetchItemsForSelect<T>(path: string, limit = 500): Promise<T[]> {
  const res = await fetchPaginated<T>(path, 1, limit);
  return res.items;
}
