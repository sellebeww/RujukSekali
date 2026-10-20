import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DEMO_DATABASE_URL: z.string().url(),
  TEST_DATABASE_URL: z.string().url().optional(),
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  COOKIE_DOMAIN: z.string().optional(),
  SESSION_SECRET: z.string().min(16),
  NATIONAL_ID_PEPPER: z.string().min(16),
  CRON_SECRET: z.string().min(16),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;
export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
