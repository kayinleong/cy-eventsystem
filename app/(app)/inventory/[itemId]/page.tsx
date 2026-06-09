// Phase 2 — /inventory/[itemId] detail route (Block C UI swap).
//
// REQUIREMENTS:
//   - INV-08 — detail page with stock breakdown + chronological transaction
//     history (rendered via ItemHistoryTab which subscribes to the
//     transactions collection via useTransactionsLive — plan 02-06 Task 2/4)
//   - INV-10 — QR label preview reachable from detail (bwip-js, client-side
//     only — Phase 1 surface preserved)
//   - INV-05 — admin retire flow reachable from detail (RetireItemButton)
//
// Next 16 — params is async (must be awaited). Same precedent as the edit
// route. The page is a Server Component; the interactive surfaces (print
// dialog, retire dialog, history feed) live in client islands.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { verifySession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { getItemServer } from "@/lib/data/inventory.server";
import {
  ItemDetail,
  type ItemDetailDeliveryOrder,
} from "@/components/feature/inventory/ItemDetail";

type RouteProps = { params: Promise<{ itemId: string }> };

function tsToIso(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof ts === "string") return ts;
  return null;
}

async function fetchLinkedDeliveryOrders(
  doIds: string[],
): Promise<ItemDetailDeliveryOrder[]> {
  if (doIds.length === 0) return [];
  const refs = doIds.map((id) =>
    adminDb.collection("deliveryOrders").doc(id),
  );
  const snaps = await adminDb.getAll(...refs);
  return snaps
    .filter((s) => s.exists)
    .map((s) => {
      const d = s.data()!;
      return {
        id: s.id,
        vendor: (d.vendor as string) ?? "",
        uploadedAt: tsToIso(d.uploadedAt),
      };
    });
}

export async function generateMetadata({
  params,
}: RouteProps): Promise<Metadata> {
  const { itemId } = await params;
  const item = await getItemServer(itemId);
  return { title: item ? item.name : "Item not found" };
}

export default async function ItemDetailPage({ params }: RouteProps) {
  const { itemId } = await params;
  const item = await getItemServer(itemId);
  if (!item) notFound();
  const session = await verifySession();
  const isAdmin = session?.role === "admin";
  const deliveryOrders = await fetchLinkedDeliveryOrders(item.deliveryOrderIds);
  return (
    <ItemDetail item={item} isAdmin={isAdmin} deliveryOrders={deliveryOrders} />
  );
}
