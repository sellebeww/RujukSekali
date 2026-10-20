// Lighthouse CI on the main profile pages (mobile preset). Run via `npm run lighthouse` after an E2E build.
const PORT = 3200;
const pages = ['/', '/cara-kerja', '/untuk-rumah-sakit', '/untuk-pasien', '/hasil-simulasi', '/minta-demo'];

module.exports = {
  ci: {
    collect: {
      startServerCommand: `npx next start -p ${PORT}`,
      startServerReadyPattern: 'Ready',
      url: pages.map((p) => `http://localhost:${PORT}${p}`),
      numberOfRuns: 3,
      settings: { chromeFlags: '--headless=new --no-sandbox' },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
        'categories:accessibility': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
        'categories:best-practices': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
        'categories:seo': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
