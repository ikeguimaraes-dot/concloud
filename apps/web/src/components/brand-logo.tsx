export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'brand-logo compact' : 'brand-logo'}>
      <img src="/concloud-logo.png" alt="ConCloud — Contabilidade em Nuvem" />
    </span>
  );
}
