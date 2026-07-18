import type { APIRoute } from 'astro';
import { pauseAttempt } from '../../../../../lib/exam-api';
import { jsonResponse, resolveOwnedAttemptId } from '../_lib';

// Freezes the server-side timer and (per the client controller, Phase 4)
// disables inputs client-side (REQ-004).
export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

  const resolved = await resolveOwnedAttemptId(context.params.id, user.id);
  if ('error' in resolved) return resolved.error;

  const ok = await pauseAttempt(resolved.attemptId, user.id);
  // ok:false means the attempt was already paused or already submitted —
  // not a client error, just a no-op the controller can ignore.
  return jsonResponse({ ok }, 200);
};
