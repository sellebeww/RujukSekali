import type { MetadataRoute } from 'next';
import { links, siteRoutes } from '@/config/links';

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(siteRoutes).map((path) => ({
    url: links.site.absolute(path),
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : 0.7,
  }));
}
