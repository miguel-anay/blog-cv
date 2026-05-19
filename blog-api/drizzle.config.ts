import type { Config } from 'drizzle-kit';

export default {
  schema: './src/infrastructure/db/schema.ts',
  out: './src/infrastructure/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_TOKEN,
  },
} satisfies Config;
