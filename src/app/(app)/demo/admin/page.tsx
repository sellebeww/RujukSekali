import { asc } from 'drizzle-orm';
import { AdminUnitView } from '@/features/shared/AdminUnitView';

import { SYSTEM_ACTOR, makeCtx } from '@/server/context';
import { serviceType } from '@/server/db/schema';
import { capacityOverview, todayLocal } from '@/server/queries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kapasitas & aturan' };

export default async function AdminUnit() {

  const db = makeCtx('demo', SYSTEM_ACTOR).db;
  const services = await db.select().from(serviceType).orderBy(asc(serviceType.sortOrder));
  return <AdminUnitView zone="demo" services={services} capacity={await capacityOverview(db, todayLocal())} />;
}
