// Private helper module for the attempts API routes — NOT a route itself
// (no GET/POST export), Astro won't register it as an endpoint.
import { getAttemptOwnerId } from '../../../../lib/exam-api';

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function parseAttemptId(param: string | undefined): number | null {
  if (!param) return null;
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Parses the `[id]` route param and verifies ownership before any route logic
 * runs (REQ-008). Returns the numeric attempt id on success, or a `Response`
 * to return immediately on failure:
 * - 400 if the param isn't a valid positive integer
 * - 404 if no attempt exists with that id
 * - 403 if the attempt exists but belongs to a different user
 */
export async function resolveOwnedAttemptId(
  idParam: string | undefined,
  userId: string,
): Promise<{ attemptId: number } | { error: Response }> {
  const attemptId = parseAttemptId(idParam);
  if (attemptId === null) {
    return { error: jsonResponse({ error: 'Invalid attempt id' }, 400) };
  }

  const ownerId = await getAttemptOwnerId(attemptId);
  if (ownerId === null) {
    return { error: jsonResponse({ error: 'Attempt not found' }, 404) };
  }
  if (ownerId !== userId) {
    return { error: jsonResponse({ error: 'Forbidden' }, 403) };
  }

  return { attemptId };
}
