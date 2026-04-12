'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { EstablishmentForm, type EstRole } from '@/components/EstablishmentForm';
import { getToken } from '@/lib/api';
import { canEdit } from '@/lib/permissions';

function Inner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const role = (sp.get('role') === 'DESTINATION' ? 'DESTINATION' : 'DEPOSIT') as EstRole;

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else if (!canEdit('estabelecimentos')) router.replace(`/estabelecimentos/${id}`);
  }, [router, id]);

  if (!getToken()) return null;
  if (!canEdit('estabelecimentos')) return null;

  return <EstablishmentForm mode="edit" establishmentId={id} role={role} />;
}

export default function EstabelecimentosEditarPage() {
  return (
    <Suspense fallback={<p className="text-slate-600 text-sm">Carregando…</p>}>
      <Inner />
    </Suspense>
  );
}
