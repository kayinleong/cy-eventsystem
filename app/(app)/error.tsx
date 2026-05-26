"use client";

// Phase 2 — Plan 02-12 — Wave 11 Block H
// App-wide error boundary for every authenticated /(app)/* route.
//
// CRITICAL — T-02-12-01 mitigation:
//   error.message may contain Firebase Admin SDK internals (e.g. "auth/...",
//   "Could not load default credentials"). NEVER render it in JSX.
//   Only `error.digest` (an opaque Next.js-generated hash) is safe to show
//   so the user can quote it to support. console.error logs the full Error
//   object server-side (Vercel / Firebase Functions logs).
//
// Next 16 — error.tsx MUST be a Client Component (uses React error
// boundaries under the hood). The default `reset` prop is preserved here
// per stable Next 16 contract; `unstable_retry` is the newer alternative
// but `reset` is still fully supported and avoids the `unstable_` prefix.
//
// HTML hygiene: (app)/layout.tsx already renders a top-level <main>, so
// this component is wrapped in <div>, not a nested <main>. Per Next 16
// docs: error.js renders INSIDE the same-segment layout's <main>.

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server logs capture full error via Next.js framework; this client log
    // is for browser-side observability. error.message + digest only —
    // never log session tokens or Firebase credentials.
    console.error("[app/(app)/error]", error.message, error.digest);
  }, [error]);

  return (
    <div className="grid place-items-center min-h-[60vh] px-4 py-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground">
          We couldn&apos;t load this page. Try again or come back later.
        </p>
        {error.digest ? (
          <p className="text-xs text-muted-foreground font-mono">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="flex gap-2 justify-center">
          <Button onClick={() => reset()}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => window.location.assign("/")}
          >
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
