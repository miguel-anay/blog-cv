import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_TOKEN,
  });
  _db = drizzle(client, { schema });
  return _db;
}
