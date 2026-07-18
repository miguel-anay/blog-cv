import { defineMiddleware } from 'astro:middleware';
import { auth } from './lib/auth';

const protectedApiPrefixes = ['/api/exams'];
const protectedPagePrefixes = ['/courses', '/exams'];

export const onRequest = defineMiddleware(async (context, next) => {
  const session = await auth.api.getSession({ headers: context.request.headers });

  context.locals.user = session?.user ?? null;
  context.locals.session = session?.session ?? null;

  if (!session) {
    // API calls (fetch()) can't be redirected to an HTML login page — respond 401 JSON instead.
    if (protectedApiPrefixes.some((prefix) => context.url.pathname.startsWith(prefix))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (protectedPagePrefixes.some((prefix) => context.url.pathname.startsWith(prefix))) {
      return context.redirect('/login?redirect=' + encodeURIComponent(context.url.pathname));
    }
  }

  return next();
});
