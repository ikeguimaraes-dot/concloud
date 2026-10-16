export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'brand-logo compact' : 'brand-logo'}>
      <img src="/concloud-brand-2026.png" alt="ConCloud — Contabilidade em Nuvem" />
    </span>
  );
}
