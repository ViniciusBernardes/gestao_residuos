'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DepositosRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/estabelecimentos?role=DEPOSIT');
  }, [router]);
  return <p className="text-slate-600 text-sm">Redirecionando…</p>;
}
