import { timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const secret = process.env.API_SECRET;

  if (!secret) {
    console.warn('[auth] API_SECRET is not configured — write endpoints are unprotected');
    return c.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'API not properly configured' } }, 503);
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing authorization token' } }, 401);
  }

  const token = authHeader.slice(7);

  // Use timing-safe comparison to prevent timing attacks
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(secret);

  if (tokenBuf.length !== secretBuf.length || !timingSafeEqual(tokenBuf, secretBuf)) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid authorization token' } }, 401);
  }

  await next();
};
