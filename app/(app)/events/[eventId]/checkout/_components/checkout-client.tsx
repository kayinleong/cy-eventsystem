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
// quick-kayinleong-006: After a successful commit, ScanSessionProvider
// fires onCommitSuccess → CheckoutGroupDialog is shown. "Skip" or "Done"
// both navigate to the event page via onDone (router.push + router.refresh).
//
// quick-kayinleong-010: onCommitSuccess also fires createCheckoutDeliveryOrderAction
// in the background. Toast fires on success; silent on failure (non-blocking).

"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  ScanSessionProvider,
  useScanSession,
  type CommitSuccessPayload,
} from "@/components/feature/scan/scan-session";
import { ScannerWidget } from "@/components/feature/scan/ScannerWidget";
import { ScanCartPanel } from "@/components/feature/scan/ScanCartPanel";
import { ScanHeader } from "@/components/feature/scan/ScanHeader";
import { ManualEntryInput } from "@/components/feature/scan/ManualEntryInput";
import { CheckoutGroupDialog } from "./CheckoutGroupDialog";
import { createCheckoutDeliveryOrderAction } from "@/app/(app)/delivery-orders/actions";
import type { EventDoc } from "@/lib/types/event";

function CheckoutBody() {
  const { addLine } = useScanSession();
  return (
    <div className="space-y-6">
      <ScanHeader />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <ScannerWidget />
          <ManualEntryInput onSubmit={async (sku) => { await addLine(sku); }} />
        </div>
        <ScanCartPanel />
      </div>
    </div>
  );
}

export function CheckoutClient({ event }: { event: EventDoc }) {
  const router = useRouter();
  const [groupPayload, setGroupPayload] = useState<CommitSuccessPayload | null>(
    null,
  );

  return (
    <>
      <ScanSessionProvider
        initialMode="checkout"
        initialEvent={event}
        onCommitSuccess={(payload) => {
          setGroupPayload(payload);
          // Fire DO creation in the background — non-blocking.
          createCheckoutDeliveryOrderAction({
            eventId: event.id,
            eventName: event.name,
            itemIds: payload.cart.map((l) => l.itemId),
            txIds: payload.txIds,
          }).then((result) => {
            if (result.ok) {
              toast.success("Delivery order created");
            }
            // Silent on failure — DO creation is best-effort from the client
            // perspective; the checkout already committed.
          });
        }}
      >
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

      {groupPayload && (
        <CheckoutGroupDialog
          payload={groupPayload}
          eventName={event.name}
          eventStartDate={event.startDate}
          onDone={() => {
            setGroupPayload(null);
            router.push(`/events/${event.id}`);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
