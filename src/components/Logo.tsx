import { brand } from '@/config/brand.config';

// Two-tone wordmark split at the second capital ("Rujuk|Sekali"); any other name renders in one colour.
const [, head = brand.name, tail = ''] = /^(.[^A-Z]*)([A-Z].*)?$/.exec(brand.name) ?? [];

/** Cross mark (public/icon.svg, transparent) + wordmark. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG; next/image adds nothing here */}
      <img src="/icon.svg" alt="" width={32} height={32} className="shrink-0" />
      <span className="text-xl font-extrabold tracking-tight">
        <span className="text-brand-blue">{head}</span>
        <span className="text-brand-wordmark-2">{tail}</span>
      </span>
    </span>
  );
}
