import type { APIRoute } from 'astro';
import { createAttempt, getExamById } from '../../../../lib/exam-api';
import { jsonResponse } from './_lib';

// Called by the zero-JS `<form method="post" action="/api/exams/attempts">`
// on `/exams/[slug]`, which posts `examId` as `application/x-www-form-urlencoded`
// (not JSON) — `request.formData()` handles both urlencoded and multipart.
export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

  const form = await context.request.formData();
  const rawExamId = form.get('examId');
  const examId = rawExamId != null ? Number(rawExamId) : NaN;
  if (!Number.isInteger(examId) || examId <= 0) {
    return jsonResponse({ error: 'Invalid examId' }, 400);
  }

  const attempt = await createAttempt(examId, user.id);
  if (!attempt) return jsonResponse({ error: 'Exam not found' }, 404);

  const exam = await getExamById(examId);
  if (!exam) return jsonResponse({ error: 'Exam not found' }, 404);

  return context.redirect(`/exams/${exam.slug}/attempt/${attempt.id}`, 302);
};
