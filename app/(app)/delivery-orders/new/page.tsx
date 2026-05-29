// quick-kayinleong-001 — admin-only DO upload page.
//
// SSR-prefetches the inventory list (cap 500, mirrors the check-in form
// cap in app/(app)/events/[eventId]/checkin/_components/checkin-form.tsx)
// so the multi-select combobox has data on first paint.

import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/dal";
import { getInventoryPage } from "@/lib/data/inventory.server";
import { DeliveryOrderForm } from "@/components/feature/delivery-orders/DeliveryOrderForm";

export const metadata: Metadata = { title: "New Delivery Order" };

export default async function NewDeliveryOrderPage() {
  await requireAdmin();
  const { items } = await getInventoryPage({ limit: 500 });
  return (
    <div className="space-y-6">
      <PageHeader
        title="New delivery order"
        description="Upload a vendor DO and link it to the items it covers."
      />
      <DeliveryOrderForm items={items} />
    </div>
  );
}
