import type { ErrorHandler } from 'hono';
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
  UpstreamError,
} from '../../../domain/shared/errors.js';

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof NotFoundError) {
    return c.json({ error: { code: err.code, message: err.message } }, 404);
  }

  if (err instanceof UnauthorizedError) {
    return c.json({ error: { code: err.code, message: err.message } }, 401);
  }

  if (err instanceof ValidationError) {
    return c.json({ error: { code: err.code, message: err.message } }, 422);
  }

  if (err instanceof ConflictError) {
    return c.json({ error: { code: err.code, message: err.message } }, 409);
  }

  if (err instanceof UpstreamError) {
    const status = err.message.includes('not configured') ? 503 : 502;
    return c.json({ error: { code: err.code, message: err.message } }, status);
  }

  console.error('[error]', err);
  return c.json(
    { error: { code: 'INTERNAL', message: 'An internal server error occurred' } },
    500,
  );
};
