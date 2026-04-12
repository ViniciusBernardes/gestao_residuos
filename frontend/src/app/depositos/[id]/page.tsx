'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DepositoIdRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/estabelecimentos/${id}?role=DEPOSIT`);
  }, [router, id]);
  return <p className="text-slate-600 text-sm">Redirecionando…</p>;
}
