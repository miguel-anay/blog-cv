/**
 * ingest-course.mjs
 *
 * Inserta un curso o diplomado en Turso desde un archivo JSON.
 *
 * Uso:
 *   node scripts/ingest-course.mjs scripts/data/mi-curso.json
 *
 * Formato JSON esperado:
 * {
 *   "Nombre del curso o diplomado": {
 *     "_meta": {                          // opcional — si no está, se usan defaults
 *       "slug": "mi-slug-custom",
 *       "description": "Descripción del curso",
 *       "level": "beginner|intermediate|advanced",
 *       "cover_url": "/img/cover.jpg",
 *       "published_at": "2026-03-01T00:00:00"
 *     },
 *     "drive_url": "https://drive.google.com/...",  // opcional — recurso del curso raíz
 *     "sections": {
 *       "01 - Nombre de la sección": {
 *         "drive_url": "https://drive.google.com/...",
 *         "youtube_playlist_url": "https://youtube.com/playlist?list=...",
 *         "videos": [
 *           { "title": "Grabación - Sesión 1", "youtube_url": "https://youtube.com/watch?v=..." }
 *         ],
 *         "files": [
 *           { "name": "Sesion01.pdf", "drive_url": "https://drive.google.com/file/d/.../view" }
 *         ]
 *       }
 *     }
 *   }
 * }
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Conexión ──────────────────────────────────────────────────────────────────

const ROOT = '/home/k3n5h1n/Escritorio/strapi/callous-cluster';

const env = Object.fromEntries(
  readFileSync(`${ROOT}/.env`, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const db = createClient({ url: env.TURSO_URL, authToken: env.TURSO_TOKEN });

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSlug(title) {
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita tildes
    .replace(/[^a-z0-9\s-]/g, '')                        // solo alfanumérico
    .trim()
    .replace(/\s+/g, '-')                                // espacios → guion
    .replace(/-+/g, '-')                                 // guiones múltiples
    .slice(0, 80);
}

// ── Ingesta ───────────────────────────────────────────────────────────────────

async function ingestCourse(title, data) {
  const meta   = data._meta ?? {};
  const slug   = meta.slug ?? toSlug(title);
  const hasSections = data.sections && Object.keys(data.sections).length > 0;
  const type   = hasSections ? 'diplomado' : 'course';

  // Verifica si ya existe
  const existing = await db.execute({ sql: 'SELECT id FROM courses WHERE slug = ?', args: [slug] });
  if (existing.rows.length > 0) {
    console.log(`⚠  Curso "${slug}" ya existe (id:${existing.rows[0].id}) — saltando.`);
    return;
  }

  // INSERT courses
  const courseResult = await db.execute({
    sql: `INSERT INTO courses (slug, title, description, cover_url, level, type, published_at)
          VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      slug,
      title,
      meta.description ?? title,
      meta.cover_url   ?? null,
      meta.level       ?? 'advanced',
      type,
      meta.published_at ?? null,
    ],
  });

  const courseId = Number(courseResult.rows[0].id);
  console.log(`✓ Curso creado — id:${courseId} slug:"${slug}" type:"${type}"`);

  // Si el curso tiene drive_url a nivel raíz, lo guarda como sección "Recursos generales"
  if (data.drive_url && !hasSections) {
    const secResult = await db.execute({
      sql: `INSERT INTO course_sections (course_id, "order", title) VALUES (?, ?, ?) RETURNING id`,
      args: [courseId, 1, 'Recursos generales'],
    });
    const secId = Number(secResult.rows[0].id);
    await db.execute({
      sql: `INSERT INTO course_resources (section_id, "order", type, title, url) VALUES (?, ?, ?, ?, ?)`,
      args: [secId, 1, 'link', 'Material completo (Drive)', data.drive_url],
    });
    console.log(`  ↳ Sección "Recursos generales" con drive_url raíz`);
  }

  if (!hasSections) return;

  // INSERT secciones
  const sectionEntries = Object.entries(data.sections);

  for (let si = 0; si < sectionEntries.length; si++) {
    const [sectionTitle, sectionData] = sectionEntries[si];
    const sectionOrder = si + 1;

    const secResult = await db.execute({
      sql: `INSERT INTO course_sections (course_id, "order", title) VALUES (?, ?, ?) RETURNING id`,
      args: [courseId, sectionOrder, sectionTitle],
    });
    const sectionId = Number(secResult.rows[0].id);
    console.log(`  ↳ Sección [${sectionOrder}] "${sectionTitle}" — id:${sectionId}`);

    let resourceOrder = 1;

    // Drive de la sección
    if (sectionData.drive_url) {
      await db.execute({
        sql: `INSERT INTO course_resources (section_id, "order", type, title, url) VALUES (?, ?, ?, ?, ?)`,
        args: [sectionId, resourceOrder++, 'link', 'Material del módulo (Drive)', sectionData.drive_url],
      });
    }

    // Playlist de YouTube
    if (sectionData.youtube_playlist_url) {
      await db.execute({
        sql: `INSERT INTO course_resources (section_id, "order", type, title, url) VALUES (?, ?, ?, ?, ?)`,
        args: [sectionId, resourceOrder++, 'link', 'Playlist completa', sectionData.youtube_playlist_url],
      });
    }

    // Videos individuales
    for (const video of (sectionData.videos ?? [])) {
      await db.execute({
        sql: `INSERT INTO course_resources (section_id, "order", type, title, url) VALUES (?, ?, ?, ?, ?)`,
        args: [sectionId, resourceOrder++, 'video', video.title, video.youtube_url],
      });
    }

    // Archivos (Drive)
    for (const file of (sectionData.files ?? [])) {
      await db.execute({
        sql: `INSERT INTO course_resources (section_id, "order", type, title, url, description) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [sectionId, resourceOrder++, 'link', file.name, file.drive_url, file.subfolder ?? null],
      });
    }

    console.log(`     ${resourceOrder - 1} recurso(s) insertados`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Uso: node scripts/ingest-course.mjs <ruta-al-json>');
  process.exit(1);
}

const data = JSON.parse(readFileSync(resolve(jsonPath), 'utf8'));

for (const [title, courseData] of Object.entries(data)) {
  await ingestCourse(title, courseData);
}

await db.close();
console.log('\n✓ Ingesta completa');
