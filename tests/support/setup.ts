try {
  process.loadEnvFile('.env');
} catch {
  // .env is optional for pure unit tests
}
