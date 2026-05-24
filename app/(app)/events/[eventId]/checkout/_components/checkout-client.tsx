// Phase 1 — /events/[eventId]/checkout Client island.
//
// Architecture:
//   - The parent Server Component (page.tsx) has already done auth +
//     EVT-08 access gate + event lookup + status reject. By the time
//     this Client island renders, `event` is guaranteed:
//       - to exist (parent called notFound() if missing)
//       - to be accessible to the current user (admin OR uid ∈
//         allowedStaff per EVT-08)
//       - to be in a checkout-actionable status (planned or active)
//   - Mounts ScanSessionProvider with `initialMode="checkout"` and
//     `initialEvent={event}` so the EventPickerDialog never renders
//     (event is pre-scoped — the user came from the event detail page).
//   - Reuses every Plan 08 scan-feature component verbatim: ScannerWidget,
//     ScanCartPanel, ScanHeader, ManualEntryInput. The only NEW UI here is
//     the page chrome (Back link + PageHeader) and the inner CheckoutBody
//     composition.
//
// REQUIREMENTS satisfied indirectly via Plan 08 substrate:
//   - CO-04 — atomic checkout via store.checkout (inside scan-session.commit)
//   - CO-05 — failed lines surface as toast.error, cart stays intact
//   - CO-06 — synchronous mock store mutation; cart re-renders instantly
//   - CO-07 — 1500ms debounce + haptic in ScannerWidget
//   - CO-08 — ManualEntryInput typed-SKU fallback
//   - CO-09 — 5 formats in ScannerWidget (qr_code, code_128, ean_13, upc_a, data_matrix)
//   - CO-10 — ManualEntryInput's Enter handler IS the Bluetooth scanner handler
//
// On successful commit, ScanSessionProvider.commit() already calls
// router.push(`/events/${selectedEvent.id}`) — which is the page the user
// came from. So no extra success-redirect logic is needed here; the
// substrate does it.

"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  ScanSessionProvider,
  useScanSession,
} from "@/components/feature/scan/scan-session";
import { ScannerWidget } from "@/components/feature/scan/ScannerWidget";
import { ScanCartPanel } from "@/components/feature/scan/ScanCartPanel";
import { ScanHeader } from "@/components/feature/scan/ScanHeader";
import { ManualEntryInput } from "@/components/feature/scan/ManualEntryInput";
import type { EventDoc } from "@/lib/types/event";

function CheckoutBody() {
  const { addLine } = useScanSession();
  return (
    <div className="space-y-6">
      <ScanHeader />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <ScannerWidget />
          <ManualEntryInput onSubmit={(sku) => addLine(sku)} />
        </div>
        <ScanCartPanel />
      </div>
    </div>
  );
}

export function CheckoutClient({ event }: { event: EventDoc }) {
  return (
    <ScanSessionProvider initialMode="checkout" initialEvent={event}>
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/events/${event.id}`}>
            <ChevronLeft className="mr-1 size-4" /> Back to event
          </Link>
        </Button>
        <PageHeader
          title={`Check out · ${event.name}`}
          description="Scan items to add them to this event's check-out cart."
        />
        <CheckoutBody />
      </div>
    </ScanSessionProvider>
  );
}
