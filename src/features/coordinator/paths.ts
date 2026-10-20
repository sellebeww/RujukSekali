import { links } from '@/config/links';

export type Zone = 'app' | 'demo';

export const zonePaths = (zone: Zone) => ({
  queue: zone === 'demo' ? links.demo.coordinator() : links.app.dashboard(),
  episode: (id: string) => (zone === 'demo' ? links.demo.episode(id) : links.app.episode(id)),
  newEpisode: zone === 'demo' ? links.demo.newEpisode() : links.app.newEpisode(),
});
