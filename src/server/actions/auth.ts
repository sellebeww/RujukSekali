'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { links } from '@/config/links';
import { login } from '../auth';
import type { ActionState } from './ctx';

const schema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Isi kata sandi'),
});

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({ email: fd.get('email'), password: fd.get('password') });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const res = await login(parsed.data.email, parsed.data.password);
  if (!res.ok) return { ok: false, message: res.message };
  const next = String(fd.get('next') ?? '');
  // Only app-internal paths are accepted as a post-login destination.
  redirect(/^\/app(\/[\w\-/]*)?$/.test(next) ? next : links.app.dashboard());
}
