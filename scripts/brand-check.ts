// Proof that renaming the product is a one-line change: build with a temporary name, crawl the pages,
// and fail if the old name appears anywhere in the rendered HTML.
import { execSync, spawn } from 'node:child_process';
import { siteRoutes } from '../src/config/links';
import { loadEnv } from './env';

loadEnv();
const OLD = 'RujukSekali';
const NEW = 'NamaUji';
const PORT = 3300;
const env = {
  ...process.env,
  BRAND_NAME_OVERRIDE: NEW,
  NEXT_DIST_DIR: '.next-brand',
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL,
  DEMO_DATABASE_URL: process.env.E2E_DEMO_DATABASE_URL ?? process.env.DEMO_DATABASE_URL,
  PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  APP_URL: `http://localhost:${PORT}`,
  LOG_SILENT: '1',
};
execSync('npx next build', { stdio: 'inherit', env });
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { env, stdio: 'ignore' });
try {
  for (let i = 0; i < 60; i++) {
    if (
      await fetch(`http://localhost:${PORT}/`)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const paths = [
    ...Object.values(siteRoutes),
    '/masuk',
    '/demo',
    '/tidak-ada',
    '/sitemap.xml',
    '/robots.txt',
  ];
  const problems: string[] = [];
  for (const p of paths) {
    const html = await (await fetch(`http://localhost:${PORT}${p}`)).text();
    if (html.includes(OLD)) problems.push(`${p}: masih memuat "${OLD}"`);
    if (p !== '/sitemap.xml' && p !== '/robots.txt' && !html.includes(NEW))
      problems.push(`${p}: nama baru "${NEW}" tidak muncul`);
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
  } else console.log(`OK: ${paths.length} halaman memakai "${NEW}" dan tidak ada sisa "${OLD}".`);
} finally {
  server.kill();
}
