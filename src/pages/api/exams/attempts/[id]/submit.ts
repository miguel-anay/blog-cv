import type { APIRoute } from 'astro';
import { getAttemptStatus, submitAttempt } from '../../../../../lib/exam-api';
import { jsonResponse, resolveOwnedAttemptId } from '../_lib';

// Manual submission from the Quiz Summary panel (REQ-006) — the only other
// path that finalizes an attempt is server-side auto-submit on timeout
// (exam-api.ts's saveAnswer/getAttemptStatus), never this route.
export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

  const resolved = await resolveOwnedAttemptId(context.params.id, user.id);
  if ('error' in resolved) return resolved.error;

  // A paused attempt must be resumed before it can be submitted — otherwise
  // pause would freeze the clock but not actually stop the flow.
  const status = await getAttemptStatus(resolved.attemptId, user.id);
  if (status?.paused) return jsonResponse({ error: 'Attempt is paused. Resume first.' }, 409);

  const result = await submitAttempt(resolved.attemptId, user.id);
  if (!result) return jsonResponse({ error: 'Attempt not found' }, 404);

  return jsonResponse(
    { redirect: `/exams/${result.examSlug}/attempt/${result.attemptId}/results` },
    200,
  );
};
