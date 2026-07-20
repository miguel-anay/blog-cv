/**
 * migrate.mjs
 *
 * Aplica contra Turso las migraciones SQL de src/lib/migrations/ que todavía
 * no se hayan aplicado, en orden por prefijo numérico. Lleva registro de lo
 * ya aplicado en una tabla `_migrations`, así que correrlo repetidas veces
 * (p. ej. en cada deploy) es seguro: solo ejecuta lo pendiente.
 *
 * Los archivos *_rollback.sql se ignoran — son manuales, opt-in, nunca se
 * corren automáticamente.
 *
 * Uso normal (aplica lo pendiente):
 *   TURSO_URL=... TURSO_TOKEN=... node scripts/migrate.mjs
 *
 * Uso baseline (marca TODAS las migraciones existentes como aplicadas, sin
 * ejecutarlas — para cuando la DB ya tiene el schema aplicado a mano):
 *   TURSO_URL=... TURSO_TOKEN=... node scripts/migrate.mjs --baseline
 */

import { createClient } from '@libsql/client';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'src', 'lib', 'migrations');

const env = process.env;
if (!env.TURSO_URL || !env.TURSO_TOKEN) {
  console.error('Faltan TURSO_URL / TURSO_TOKEN en el entorno.');
  process.exit(1);
}

const baseline = process.argv.includes('--baseline');

const db = createClient({ url: env.TURSO_URL, authToken: env.TURSO_TOKEN });

async function main() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const allFiles = await readdir(migrationsDir);
  const migrationFiles = allFiles
    .filter((f) => f.endsWith('.sql') && !f.includes('_rollback'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const { rows: appliedRows } = await db.execute('SELECT filename FROM _migrations');
  const applied = new Set(appliedRows.map((r) => r.filename));

  const pending = migrationFiles.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('No hay migraciones pendientes.');
    return;
  }

  if (baseline) {
    for (const filename of pending) {
      await db.execute({
        sql: 'INSERT INTO _migrations (filename) VALUES (?)',
        args: [filename],
      });
      console.log(`[baseline] marcada como aplicada: ${filename}`);
    }
    return;
  }

  for (const filename of pending) {
    const sql = await readFile(path.join(migrationsDir, filename), 'utf-8');
    console.log(`Aplicando ${filename}...`);
    // executeMultiple (not db.batch) because the migration SQL contains string
    // literals with embedded semicolons (e.g. markdown/code snippets) — only
    // a real SQL parser can split statements safely, a naive split on ';'
    // would corrupt those. BEGIN/COMMIT wrap the file + tracking INSERT in one
    // transaction sent over the same executeMultiple call, so a mid-file
    // failure rolls back everything instead of leaving a half-applied
    // migration that a retry can't recover from.
    const escapedFilename = filename.replace(/'/g, "''");
    await db.executeMultiple(
      `BEGIN;\n${sql}\nINSERT INTO _migrations (filename) VALUES ('${escapedFilename}');\nCOMMIT;`,
    );
    console.log(`Aplicada ${filename}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.close());
