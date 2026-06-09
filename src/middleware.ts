import { defineMiddleware } from 'astro:middleware';
import { auth } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const session = await auth.api.getSession({ headers: context.request.headers });

  context.locals.user = session?.user ?? null;
  context.locals.session = session?.session ?? null;

  if (context.url.pathname.startsWith('/courses')) {
    if (!session) {
      return context.redirect('/login?redirect=' + encodeURIComponent(context.url.pathname));
    }
  }

  return next();
});
