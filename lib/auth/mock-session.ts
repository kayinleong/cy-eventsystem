// lib/auth/mock-session.ts — Phase 2 re-export shim.
//
// This file used to host the Phase 1 mock-cookie session helpers. In plan
// 02-03 the real DAL (lib/auth/dal.ts) took over. 12 other (app) consumers
// still import `requireSession`, `requireAdmin`, and `getMockSession` from
// this path — those will be migrated incrementally in plans 02-04..02-10
// (Blocks B..G). Until then this shim re-exports the real DAL so the build
// stays green and the call sites get the production behavior.
//
// **DELETE this file in plan 02-11** once every (app) consumer has been
// rewritten to import from `@/lib/auth/dal` directly.

export {
  verifySession,
  getSession,
  getSession as getMockSession,
  requireSession,
  requireAdmin,
} from "./dal";
