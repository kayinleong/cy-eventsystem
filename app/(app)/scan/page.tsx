// Phase 1 — /scan standalone scanner page.
//
// REQUIREMENTS:
//   - SCN-01 — mode toggle (check-out / check-in).
//   - SCN-02..06 — scanner UX (handled by ScannerWidget + ManualEntryInput).
//   - CO-02 — post-scan event picker filtered to accessible planned+active events.
//   - CO-03 / CO-06 — scan-cart accumulates with adjustable qty + remove.
//   - CO-07..10 — debounced scans, manual fallback, 5 formats, Bluetooth scanner.
//   - CI-02 — check-in mode routes to the per-event check-in screen on commit.
//   - D-15 — selected event is sticky for the session; ends via "End session".
//
// Architecture:
//   - Client Component because the inner UI uses hooks (useSearchParams,
//     scan-session context). Next 16 requires that a Client Component using
//     `useSearchParams` be wrapped in `<Suspense>`, otherwise production
//     builds fail with "Missing Suspense boundary with useSearchParams"
//     (see node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
//     use-search-params.md lines 176-183). The page exports a tiny shell
//     that mounts `<Suspense>` around the actual scan UI.
//
// Phase 2 swap surface: nothing in this file changes. The Client island's
// store.checkout call (in scan-session.tsx) swaps to a Server Action.

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  ScanSessionProvider,
  useScanSession,
  type ScanMode,
} from "@/components/feature/scan/scan-session";
import { ScannerWidget } from "@/components/feature/scan/ScannerWidget";
import { ScanCartPanel } from "@/components/feature/scan/ScanCartPanel";
import { ScanHeader } from "@/components/feature/scan/ScanHeader";
import { EventPickerDialog } from "@/components/feature/scan/EventPickerDialog";
import { ManualEntryInput } from "@/components/feature/scan/ManualEntryInput";

function ScanInner() {
  const { mode, setMode, selectedEvent, selectEvent, addLine } =
    useScanSession();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scan"
        description={
          mode === "checkout"
            ? "Scan items to check them out."
            : "Scan items being returned."
        }
      />
      <Tabs value={mode} onValueChange={(v) => setMode(v as ScanMode)}>
        <TabsList>
          <TabsTrigger value="checkout">Check out</TabsTrigger>
          <TabsTrigger value="checkin">Check in</TabsTrigger>
        </TabsList>
      </Tabs>

      <ScanHeader />

      {!selectedEvent ? (
        <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Pick an event to begin scanning.
          </p>
          <Button onClick={() => setPickerOpen(true)}>Pick event</Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <ScannerWidget />
          <ManualEntryInput
            onSubmit={(sku) => addLine(sku)}
            disabled={!selectedEvent}
          />
        </div>
        <ScanCartPanel />
      </div>

      <EventPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(e) => selectEvent(e)}
      />
    </div>
  );
}

function ScanPageContent() {
  const searchParams = useSearchParams();
  const initialMode: ScanMode =
    searchParams.get("mode") === "checkin" ? "checkin" : "checkout";
  return (
    <ScanSessionProvider initialMode={initialMode}>
      <ScanInner />
    </ScanSessionProvider>
  );
}

export default function ScanPage() {
  // Suspense boundary required by Next 16 around `useSearchParams` in a
  // Client Component (see file header note). Fallback is a no-op since the
  // (app) layout already renders the chrome.
  return (
    <Suspense fallback={null}>
      <ScanPageContent />
    </Suspense>
  );
}
