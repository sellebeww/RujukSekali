import { brand } from '@/config/brand.config';

/** Wordmark + route-line mark. The mark is the product idea: one line, several stops. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true" className="shrink-0">
        <rect width="64" height="64" rx="14" fill="var(--color-teal)" />
        <path d="M14 44c8-20 16 4 24-12s8-12 12-12" fill="none" stroke="var(--color-paper)" strokeWidth="5" strokeLinecap="round" />
        <circle cx="14" cy="44" r="5" fill="var(--color-ochre-soft)" />
        <circle cx="50" cy="20" r="5" fill="var(--color-clay-soft)" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight">{brand.name}</span>
    </span>
  );
}
