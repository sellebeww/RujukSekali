import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/server/auth';
import { getDb } from '@/server/db/client';
import { metricsCsv, operationalMetrics } from '@/server/metrics';

export async function GET(req: NextRequest) {
  const demo = req.nextUrl.searchParams.get('zona') === 'demo';
  if (!demo && !(await getSessionUser())) return new NextResponse('Masuk terlebih dahulu.', { status: 401 });
  const m = await operationalMetrics(getDb(demo ? 'demo' : 'app'), Date.now());
  return new NextResponse(metricsCsv(m), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="metrik-${demo ? 'demo' : 'operasional'}.csv"`,
    },
  });
}
