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
import { getItemServer } from "@/lib/data/inventory.server";
import { ItemDetail } from "@/components/feature/inventory/ItemDetail";

type RouteProps = { params: Promise<{ itemId: string }> };

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
  return <ItemDetail item={item} isAdmin={isAdmin} />;
}
