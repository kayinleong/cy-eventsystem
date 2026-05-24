// /register — AUTH-06: admin-invite-only project. No public registration.
//
// Invoking `notFound()` throws NEXT_HTTP_ERROR_FALLBACK;404 and returns the
// nearest not-found UI (or Next's default 404). Per PROJECT.md key decision
// #2 — registration flows entirely through admin-invite (the admin uses
// /users/invite which sends a Firebase signed link; recipients land on
// /set-password to complete account setup).
//
// Phase 2: this file remains as a 404. Removing it would let users hit a
// blank route — the explicit notFound() is the safer pattern.

import { notFound } from "next/navigation";

export default function RegisterPage(): never {
  notFound();
}
