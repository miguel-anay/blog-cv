import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  if (_db) return _db;

  const url = import.meta.env.TURSO_URL ?? process.env.TURSO_URL;
  const authToken = import.meta.env.TURSO_TOKEN ?? process.env.TURSO_TOKEN;

  if (!url) throw new Error('TURSO_URL env var is not set');

  _db = drizzle(createClient({ url, authToken }), { schema });
  return _db;
}
