import type { ReactNode } from 'react';

export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="paper-grain border-b border-line">
      <div className="container-page py-12 sm:py-16">
        <p className="text-sm font-semibold tracking-wide text-clay uppercase">{eyebrow}</p>
        <h1 className="mt-2 max-w-4xl text-4xl sm:text-5xl">{title}</h1>
        {lead && <p className="mt-4 max-w-3xl text-xl text-ink-soft">{lead}</p>}
        {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}
