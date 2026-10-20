import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Tone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

const tones: Record<Tone, string> = {
  primary: 'bg-teal text-paper hover:bg-ink border-teal',
  accent: 'bg-clay text-white hover:bg-[#7d2f18] border-clay',
  secondary: 'bg-card text-ink hover:bg-paper-deep border-line',
  ghost: 'bg-transparent text-ink hover:bg-paper-deep border-transparent',
  danger: 'bg-card text-danger hover:bg-danger-soft border-danger/40',
};

const base =
  'inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-[0.95rem] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 min-h-11';

export function Button({
  tone = 'primary',
  className = '',
  ...props
}: ComponentProps<'button'> & { tone?: Tone }) {
  return <button {...props} className={`${base} ${tones[tone]} ${className}`} />;
}

export function LinkButton({
  tone = 'primary',
  className = '',
  external,
  ...props
}: ComponentProps<typeof Link> & { tone?: Tone; external?: boolean }) {
  if (external) {
    const { href, ...rest } = props;
    return (
      <a
        {...(rest as ComponentProps<'a'>)}
        href={String(href)}
        className={`${base} ${tones[tone]} ${className}`}
      />
    );
  }
  return <Link {...props} className={`${base} ${tones[tone]} ${className}`} />;
}

type BadgeTone = 'teal' | 'ochre' | 'leaf' | 'clay' | 'neutral' | 'danger';
const badgeTones: Record<BadgeTone, string> = {
  teal: 'bg-teal-soft text-teal',
  ochre: 'bg-ochre-soft text-ochre',
  leaf: 'bg-leaf-soft text-leaf',
  clay: 'bg-clay-soft text-clay',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-paper-deep text-ink-soft',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Notice({
  tone = 'teal',
  title,
  children,
  role,
}: {
  tone?: BadgeTone;
  title?: ReactNode;
  children?: ReactNode;
  role?: 'alert' | 'status' | 'note';
}) {
  const border: Record<BadgeTone, string> = {
    teal: 'border-teal',
    ochre: 'border-ochre',
    leaf: 'border-leaf',
    clay: 'border-clay',
    danger: 'border-danger',
    neutral: 'border-line',
  };
  return (
    <div
      role={role}
      className={`rounded-lg border-l-4 ${border[tone]} ${badgeTones[tone]} px-4 py-3 text-[0.95rem]`}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className="text-ink">{children}</div>}
    </div>
  );
}

export function Card({
  children,
  className = '',
  as: As = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article' | 'li';
}) {
  return <As className={`ticket p-5 ${className}`}>{children}</As>;
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base text-ink placeholder:text-muted/70 focus:border-teal min-h-11';

export function SectionTitle({
  eyebrow,
  title,
  lead,
  id,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  id?: string;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow && <p className="mb-2 text-sm font-semibold tracking-wide text-clay uppercase">{eyebrow}</p>}
      <h2 id={id} className="text-3xl sm:text-4xl">
        {title}
      </h2>
      {lead && <p className="mt-3 text-lg text-ink-soft">{lead}</p>}
    </div>
  );
}

export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <span
      className="rounded bg-ochre-soft px-1.5 py-0.5 font-mono text-[0.85em] text-ochre"
      title="Konten belum tersedia"
    >
      {children}
    </span>
  );
}
