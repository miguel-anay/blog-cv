import type { APIRoute } from 'astro';
import { resumeAttempt, getAttemptStatus } from '../../../../../lib/exam-api';
import { jsonResponse, resolveOwnedAttemptId } from '../_lib';

// Unfreezes the server-side timer and re-enables inputs client-side
// (REQ-004). Returns the fresh status right after resuming so the client
// controller (Phase 4) can restart its local tick from the authoritative
// remaining time without a second round trip.
export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

  const resolved = await resolveOwnedAttemptId(context.params.id, user.id);
  if ('error' in resolved) return resolved.error;

  const ok = await resumeAttempt(resolved.attemptId, user.id);
  if (!ok) {
    // Not currently paused, or already submitted — not a client error.
    return jsonResponse({ ok: false }, 200);
  }

  const status = await getAttemptStatus(resolved.attemptId, user.id);
  if (!status) return jsonResponse({ error: 'Attempt not found' }, 404);

  return jsonResponse({ ok: true, ...status }, 200);
};
