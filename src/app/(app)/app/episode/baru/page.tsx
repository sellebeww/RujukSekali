import { NewEpisodeForm } from '@/features/coordinator/NewEpisodeForm';
import { todayLocal } from '@/server/queries';

export const metadata = { title: 'Episode baru' };

export default function NewEpisodePage() {
  return <NewEpisodeForm zone="app" today={todayLocal()} />;
}
