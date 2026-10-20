import { NextResponse, type NextRequest } from 'next/server';
import { links } from '@/config/links';
import { logout } from '@/server/auth';

export async function POST(req: NextRequest) {
  await logout();
  return NextResponse.redirect(new URL(links.site.home(), req.url), 303);
}
