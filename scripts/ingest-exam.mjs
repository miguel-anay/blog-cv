/**
 * ingest-exam.mjs
 *
 * Crea/actualiza un examen de certificación en Turso desde un archivo JSON,
 * y le agrega las preguntas que todavía no tenga cargadas.
 *
 * Pensado para armar el examen de a poco: corré el comando las veces que
 * quieras con el MISMO archivo JSON, agregando preguntas nuevas al array
 * `questions` cada vez — las que ya están cargadas (mismo texto exacto en
 * "prompt") se saltean solas, así que no hace falta llevar la cuenta de
 * cuáles ya subiste.
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
 *       "published_at": null              // null = borrador (no aparece en /exams).
 *                                          // Poné una fecha ISO cuando esté listo para publicar.
 *     },
 *     "questions": [                      // opcional — podés arrancar sin preguntas
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
 *
 * Cada corrida sincroniza los campos de "_meta" del examen (título,
 * descripción, nivel, tiempo límite, etc.) contra lo que haya en el JSON en
 * ese momento — el archivo es la fuente de verdad, así que publicarlo es
 * tan simple como cambiar `published_at` y volver a correr el comando.
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

  const examFields = {
    title,
    description: meta.description ?? title,
    cover_url: meta.cover_url ?? null,
    level: meta.level ?? 'intermediate',
    time_limit_seconds: meta.time_limit_seconds ?? 5400,
    pass_score_percent: meta.pass_score_percent ?? 70,
    published_at: meta.published_at ?? null,
  };

  // Find or create — el examen es idempotente por slug. Si ya existe, se
  // sincronizan sus campos contra el JSON (así publicar es solo cambiar
  // published_at y volver a correr el script).
  let examId;
  const existing = await db.execute({ sql: 'SELECT id FROM exams WHERE slug = ?', args: [slug] });

  if (existing.rows.length > 0) {
    examId = Number(existing.rows[0].id);
    await db.execute({
      sql: `UPDATE exams SET title = ?, description = ?, cover_url = ?, level = ?,
              time_limit_seconds = ?, pass_score_percent = ?, published_at = ?,
              updated_at = (datetime('now'))
            WHERE id = ?`,
      args: [
        examFields.title,
        examFields.description,
        examFields.cover_url,
        examFields.level,
        examFields.time_limit_seconds,
        examFields.pass_score_percent,
        examFields.published_at,
        examId,
      ],
    });
    console.log(`✓ Examen "${slug}" ya existía (id:${examId}) — datos sincronizados.`);
  } else {
    const examResult = await db.execute({
      sql: `INSERT INTO exams (slug, title, description, cover_url, level, time_limit_seconds, pass_score_percent, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [
        slug,
        examFields.title,
        examFields.description,
        examFields.cover_url,
        examFields.level,
        examFields.time_limit_seconds,
        examFields.pass_score_percent,
        examFields.published_at,
      ],
    });
    examId = Number(examResult.rows[0].id);
    console.log(`✓ Examen creado — id:${examId} slug:"${slug}"`);
  }

  console.log(
    examFields.published_at
      ? `  publicado (published_at: ${examFields.published_at})`
      : `  borrador — no aparece en /exams hasta que le pongas published_at`,
  );

  if (questions.length === 0) {
    console.log(`  (sin preguntas en este archivo todavía)`);
    return;
  }

  // Preguntas ya cargadas para este examen — se identifican por texto exacto
  // de "prompt", así una corrida posterior con el mismo JSON + preguntas
  // nuevas al final solo inserta lo que falta.
  const existingQuestions = await db.execute({
    sql: 'SELECT prompt, "order" FROM exam_questions WHERE exam_id = ?',
    args: [examId],
  });
  const existingPrompts = new Set(existingQuestions.rows.map((r) => r.prompt));
  let nextOrder = existingQuestions.rows.reduce((max, r) => Math.max(max, Number(r.order)), 0) + 1;

  let insertedCount = 0;
  let skippedCount = 0;

  for (const question of questions) {
    if (existingPrompts.has(question.prompt)) {
      skippedCount++;
      continue;
    }

    const options = question.options ?? [];
    const correctCount = options.filter((o) => o.correct).length;

    if (options.length < 2) {
      console.log(`  ⚠  Pregunta "${question.prompt.slice(0, 40)}..." tiene menos de 2 opciones — saltando.`);
      continue;
    }
    if (correctCount === 0) {
      console.log(`  ⚠  Pregunta "${question.prompt.slice(0, 40)}..." no tiene ninguna opción correcta — saltando.`);
      continue;
    }

    const qResult = await db.execute({
      sql: `INSERT INTO exam_questions (exam_id, "order", prompt, explanation, allow_multiple)
            VALUES (?, ?, ?, ?, ?) RETURNING id`,
      args: [
        examId,
        nextOrder,
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

    console.log(`  ↳ Pregunta [${nextOrder}] — id:${questionId} — ${options.length} opciones`);
    nextOrder++;
    insertedCount++;
  }

  console.log(
    `  ${insertedCount} pregunta(s) nueva(s) insertada(s)` +
      (skippedCount > 0 ? ` (${skippedCount} ya estaban cargadas, sin cambios)` : ''),
  );
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
