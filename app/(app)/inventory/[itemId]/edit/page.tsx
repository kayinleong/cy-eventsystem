// Phase 2 — /inventory/[itemId]/edit admin-gated edit form route.
//
// REQUIREMENTS:
//   - INV-03 — admins can edit inventory item fields (except sku + totalQty)
//   - AUTH-10 — staff → /unauthorized via requireAdmin's redirect
//
// Next 16 — `params` is async, must be awaited. Server Component reads the
// inventory doc via the Admin SDK helper, then hands off to the client
// ItemForm with the InventoryItem as the SSR seed. ItemForm calls the
// updateItem Server Action (plan 02-05) on submit.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/dal";
import { getItemServer } from "@/lib/data/inventory.server";
import { ItemForm } from "@/components/feature/inventory/ItemForm";

export const metadata: Metadata = { title: "Edit item" };

type RouteProps = { params: Promise<{ itemId: string }> };

export default async function EditItemPage({ params }: RouteProps) {
  await requireAdmin();
  const { itemId } = await params;
  const item = await getItemServer(itemId);
  if (!item) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title="Edit item" description={`Update ${item.name}.`} />
      <ItemForm
        mode="edit"
        itemId={itemId}
        initial={{
          name: item.name,
          sku: item.sku,
          category: item.category,
          totalQty: item.totalQty,
          unit: item.unit,
          location: item.location,
          photoUrl: item.photoUrl ?? "",
          notes: item.notes,
          lowStockThreshold: item.lowStockThreshold,
        }}
      />
    </div>
  );
}
