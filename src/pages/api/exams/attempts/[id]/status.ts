import type { APIRoute } from 'astro';
import { getAttemptStatus } from '../../../../../lib/exam-api';
import { jsonResponse, resolveOwnedAttemptId } from '../_lib';

// Polled by the attempt-taking client controller (Phase 4) to resync the
// timer against the server-authoritative remaining time (REQ-003).
export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

  const resolved = await resolveOwnedAttemptId(context.params.id, user.id);
  if ('error' in resolved) return resolved.error;

  const status = await getAttemptStatus(resolved.attemptId, user.id);
  if (!status) return jsonResponse({ error: 'Attempt not found' }, 404);

  return jsonResponse(status, 200);
};
