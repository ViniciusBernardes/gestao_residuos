'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CentrosRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/estabelecimentos?role=DESTINATION');
  }, [router]);
  return <p className="text-slate-600 text-sm">Redirecionando…</p>;
}
