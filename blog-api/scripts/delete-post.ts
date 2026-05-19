import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { articles } from '../src/infrastructure/db/schema.js';

const client = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_TOKEN,
});
const db = drizzle(client);

const slug = process.argv[2];
if (!slug) { console.error('Usage: delete-post.ts <slug>'); process.exit(1); }

await db.delete(articles).where(eq(articles.slug, slug));
console.log(`✓ Deleted: ${slug}`);
