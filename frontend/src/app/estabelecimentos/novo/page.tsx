'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { EstablishmentForm, type EstRole } from '@/components/EstablishmentForm';
import { getToken } from '@/lib/api';
import { canEdit } from '@/lib/permissions';

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const role = (sp.get('role') === 'DESTINATION' ? 'DESTINATION' : 'DEPOSIT') as EstRole;

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else if (!canEdit('estabelecimentos')) router.replace(`/estabelecimentos?role=${role}`);
  }, [router, role]);

  if (!getToken()) return null;
  if (!canEdit('estabelecimentos')) return null;

  return <EstablishmentForm mode="create" role={role} />;
}

export default function EstabelecimentosNovoPage() {
  return (
    <Suspense fallback={<p className="text-slate-600 text-sm">Carregando…</p>}>
      <Inner />
    </Suspense>
  );
}
