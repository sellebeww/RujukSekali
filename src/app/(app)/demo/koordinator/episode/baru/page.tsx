import { NewEpisodeForm } from '@/features/coordinator/NewEpisodeForm';
import { todayLocal } from '@/server/queries';

export const metadata = { title: 'Episode baru' };

export default function DemoNewEpisode() {
  return <NewEpisodeForm zone="demo" today={todayLocal()} />;
}
