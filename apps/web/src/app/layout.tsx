import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'ConCloud — Contabilidade e gestão', template: '%s · ConCloud' },
  description: 'Seu financeiro e sua contabilidade, no mesmo lugar.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
