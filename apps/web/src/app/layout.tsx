import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'ConCloud — Contabilidade e gestão', template: '%s · ConCloud' },
  description: 'Seu financeiro e sua contabilidade, no mesmo lugar.',
  icons: {
    icon: [{ url: '/concloud-icon-2026.png', type: 'image/png' }],
    shortcut: '/concloud-icon-2026.png',
    apple: '/concloud-icon-2026.png',
  },
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
