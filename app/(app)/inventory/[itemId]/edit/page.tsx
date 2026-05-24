// Phase 1 — /inventory/[itemId]/edit admin-gated edit form route.
//
// REQUIREMENTS:
//   - INV-03 — admins can edit inventory item fields (except sku + totalQty)
//   - AUTH-10 — staff → /unauthorized
//
// Next 16 — `params` is async, must be awaited (per AGENTS.md breaking-change
// warning). Same pattern as the (auth) route group precedent.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/mock-session";
import { getSnapshot } from "@/lib/mock/store";
import { selectItemById } from "@/lib/mock/selectors";
import { ItemForm } from "@/components/feature/inventory/ItemForm";

export const metadata: Metadata = { title: "Edit item" };

type RouteProps = { params: Promise<{ itemId: string }> };

export default async function EditItemPage({ params }: RouteProps) {
  await requireAdmin();
  const { itemId } = await params;
  const item = selectItemById(getSnapshot(), itemId);
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
          photoUrl: item.photoUrl ?? "",
          notes: item.notes,
          lowStockThreshold: item.lowStockThreshold,
        }}
      />
    </div>
  );
}
