'use client';

import { useSyncExternalStore } from 'react';
import { links } from '@/config/links';

// Reads a non-secret "signed in" hint cookie so static profile pages can show the right button.
function subscribe() {
  return () => {};
}
const signedIn = () => document.cookie.split('; ').some((c) => c === 'rs_signed_in=1');

export function SessionAwareCta({ className = '' }: { className?: string }) {
  const isIn = useSyncExternalStore(subscribe, signedIn, () => false);
  return isIn ? (
    <a href={links.app.dashboard()} className={className}>
      Buka Dashboard
    </a>
  ) : (
    <a href={links.app.login()} className={className}>
      Masuk
    </a>
  );
}
