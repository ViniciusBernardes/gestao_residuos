import type { Metadata } from 'next';
import { Shell } from '@/components/Shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gestão de Resíduos',
  description: 'Sistema SaaS multi-município — PoC',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
