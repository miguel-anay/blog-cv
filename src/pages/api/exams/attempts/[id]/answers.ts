import type { APIRoute } from 'astro';
import { saveAnswer } from '../../../../../lib/exam-api';
import { jsonResponse, resolveOwnedAttemptId } from '../_lib';

interface AnswersRequestBody {
  questionId?: unknown;
  selectedOptionId?: unknown;
  flaggedForReview?: unknown;
}

// Called by the client controller (Phase 4) on every question navigation,
// not only an explicit save action (REQ-005). Body is JSON, sent via fetch().
export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

  const resolved = await resolveOwnedAttemptId(context.params.id, user.id);
  if ('error' in resolved) return resolved.error;

  let body: AnswersRequestBody;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const questionId = Number(body.questionId);
  if (!Number.isInteger(questionId) || questionId <= 0) {
    return jsonResponse({ error: 'Invalid questionId' }, 400);
  }

  const selectedOptionId =
    body.selectedOptionId == null ? null : Number(body.selectedOptionId);
  if (selectedOptionId !== null && (!Number.isInteger(selectedOptionId) || selectedOptionId <= 0)) {
    return jsonResponse({ error: 'Invalid selectedOptionId' }, 400);
  }

  const flaggedForReview =
    typeof body.flaggedForReview === 'boolean' ? body.flaggedForReview : undefined;

  const result = await saveAnswer(resolved.attemptId, user.id, {
    questionId,
    selectedOptionId,
    flaggedForReview,
  });

  // { ok, expired } — matches exam-api.ts's SaveAnswerResult shape exactly.
  // expired:true means the server auto-finalized the attempt (time ran out);
  // the client must stop accepting input and redirect to results.
  return jsonResponse(result, 200);
};
