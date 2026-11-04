/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    /** Anonymous guest visitor, set by the middleware on /exams routes only. */
    user: typeof import('./lib/schema').user.$inferSelect | null;
  }
}
