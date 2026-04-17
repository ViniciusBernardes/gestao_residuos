import { join } from 'path';
import { mkdirSync } from 'fs';

export const TENANT_COAT_UPLOAD_SUBDIR = 'tenants';

export function tenantCoatUploadDir(): string {
  const dir = join(process.cwd(), 'uploads', TENANT_COAT_UPLOAD_SUBDIR);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export const COAT_ALLOWED_MIMES = new Map<string, string>([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);
