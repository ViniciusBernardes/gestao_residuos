export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function parsePageLimit(
  page?: string,
  limit?: string,
  defaultLimit = 20,
  maxLimit = 100,
): { page: number; limit: number; skip: number } {
  const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
  const raw = parseInt(limit ?? String(defaultLimit), 10) || defaultLimit;
  const l = Math.min(maxLimit, Math.max(1, raw));
  return { page: p, limit: l, skip: (p - 1) * l };
}

export function toPaginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
