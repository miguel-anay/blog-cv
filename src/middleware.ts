import { defineMiddleware } from 'astro:middleware';
import { getDb } from './lib/db';
import { user as userTable } from './lib/schema';

const GUEST_COOKIE = 'guest_id';
const examPrefixes = ['/exams', '/api/exams'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The site has no login. Exam visitors get an anonymous guest user, identified
// by a cookie, so their attempts can still be stored per visitor.
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;

  if (examPrefixes.some((prefix) => context.url.pathname.startsWith(prefix))) {
    // The cookie is visitor-controlled and becomes a DB key: accept only a UUID.
    let guestId = context.cookies.get(GUEST_COOKIE)?.value;
    if (!guestId || !UUID.test(guestId)) {
      guestId = crypto.randomUUID();
      context.cookies.set(GUEST_COOKIE, guestId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: context.url.protocol === 'https:',
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    const now = new Date();
    const guest = {
      id: `guest_${guestId}`,
      name: 'Invitado',
      email: `guest_${guestId}@guest.local`,
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
    };
    // ponytail: one idempotent insert per exam request; cache known ids if it ever shows up in latency.
    await getDb().insert(userTable).values(guest).onConflictDoNothing();
    context.locals.user = guest;
  }

  return next();
});
