/**
 * ingest-exam.mjs
 *
 * Inserta un examen de certificación en Turso desde un archivo JSON.
 *
 * Uso:
 *   node scripts/ingest-exam.mjs scripts/data/mi-examen.json
 *
 * Requiere que la migración 006_exams.sql ya haya sido aplicada:
 *   turso db shell <DB_NAME> < src/lib/migrations/006_exams.sql
 *
 * Formato JSON esperado:
 * {
 *   "Nombre del examen": {
 *     "_meta": {                          // opcional — si no está, se usan defaults
 *       "slug": "mi-examen-custom",
 *       "description": "Descripción del examen",
 *       "level": "beginner|intermediate|advanced",
 *       "cover_url": "/img/cover.jpg",
 *       "time_limit_seconds": 5400,       // default 5400 (1:30:00)
 *       "pass_score_percent": 70,         // default 70
 *       "published_at": "2026-03-01T00:00:00"  // omitilo (o null) para dejarlo sin publicar
 *     },
 *     "questions": [
 *       {
 *         "prompt": "Texto de la pregunta",
 *         "explanation": "Explicación opcional — se muestra solo en resultados, después de enviar",
 *         "options": [
 *           { "text": "Opción A", "correct": true },
 *           { "text": "Opción B", "correct": false },
 *           { "text": "Opción C", "correct": false },
 *           { "text": "Opción D", "correct": false }
 *         ]
 *       }
 *     ]
 *   }
 * }
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Conexión ──────────────────────────────────────────────────────────────────

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

async function ingestExam(title, data) {
  const meta = data._meta ?? {};
  const slug = meta.slug ?? toSlug(title);
  const questions = data.questions ?? [];

  if (questions.length === 0) {
    console.log(`⚠  Examen "${title}" no tiene preguntas — saltando.`);
    return;
  }

  // Verifica si ya existe
  const existing = await db.execute({ sql: 'SELECT id FROM exams WHERE slug = ?', args: [slug] });
  if (existing.rows.length > 0) {
    console.log(`⚠  Examen "${slug}" ya existe (id:${existing.rows[0].id}) — saltando.`);
    return;
  }

  // INSERT exams
  const examResult = await db.execute({
    sql: `INSERT INTO exams (slug, title, description, cover_url, level, time_limit_seconds, pass_score_percent, published_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      slug,
      title,
      meta.description ?? title,
      meta.cover_url ?? null,
      meta.level ?? 'intermediate',
      meta.time_limit_seconds ?? 5400,
      meta.pass_score_percent ?? 70,
      meta.published_at ?? null,
    ],
  });

  const examId = Number(examResult.rows[0].id);
  console.log(`✓ Examen creado — id:${examId} slug:"${slug}"`);

  // INSERT preguntas + opciones
  for (let qi = 0; qi < questions.length; qi++) {
    const question = questions[qi];
    const options = question.options ?? [];
    const correctCount = options.filter((o) => o.correct).length;

    if (options.length < 2) {
      console.log(`  ⚠  Pregunta [${qi + 1}] tiene menos de 2 opciones — saltando.`);
      continue;
    }
    if (correctCount === 0) {
      console.log(`  ⚠  Pregunta [${qi + 1}] no tiene ninguna opción correcta — saltando.`);
      continue;
    }

    const qResult = await db.execute({
      sql: `INSERT INTO exam_questions (exam_id, "order", prompt, explanation, allow_multiple)
            VALUES (?, ?, ?, ?, ?) RETURNING id`,
      args: [
        examId,
        qi + 1,
        question.prompt,
        question.explanation ?? null,
        correctCount > 1 ? 1 : 0,
      ],
    });
    const questionId = Number(qResult.rows[0].id);

    for (let oi = 0; oi < options.length; oi++) {
      const option = options[oi];
      await db.execute({
        sql: `INSERT INTO exam_options (question_id, "order", text, is_correct) VALUES (?, ?, ?, ?)`,
        args: [questionId, oi + 1, option.text, option.correct ? 1 : 0],
      });
    }

    console.log(`  ↳ Pregunta [${qi + 1}] — id:${questionId} — ${options.length} opciones`);
  }

  console.log(`  ${questions.length} pregunta(s) insertada(s)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Uso: node scripts/ingest-exam.mjs <ruta-al-json>');
  process.exit(1);
}

const data = JSON.parse(readFileSync(resolve(jsonPath), 'utf8'));

for (const [title, examData] of Object.entries(data)) {
  await ingestExam(title, examData);
}

await db.close();
console.log('\n✓ Ingesta completa');
