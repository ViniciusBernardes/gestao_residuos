'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CentrosNovoRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/estabelecimentos/novo?role=DESTINATION');
  }, [router]);
  return <p className="text-slate-600 text-sm">Redirecionando…</p>;
}
