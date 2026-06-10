import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { getDb } from './db';
import * as schema from './schema';
import { sendMagicLinkEmail } from './email';

// Required env vars: RESEND_API_KEY, RESEND_FROM_EMAIL, MAGIC_LINK_EXPIRY_SECONDS
export function resolveMagicLinkExpiry(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 1800;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) return 1800;
  if (n === 0) return 60 * 60 * 24 * 365 * 100; // ~100 years — operationally "no expiry"
  return n;
}

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: 'sqlite',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: import.meta.env.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET ?? '',
  baseURL: import.meta.env.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:4321',
  socialProviders: {
    google: {
      clientId: import.meta.env.GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: import.meta.env.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({ email, url });
      },
      expiresIn: resolveMagicLinkExpiry(
        import.meta.env.MAGIC_LINK_EXPIRY_SECONDS ?? process.env.MAGIC_LINK_EXPIRY_SECONDS
      ),
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
