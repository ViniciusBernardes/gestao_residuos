'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CentroIdRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/estabelecimentos/${id}?role=DESTINATION`);
  }, [router, id]);
  return <p className="text-slate-600 text-sm">Redirecionando…</p>;
}
