// Phase 1 — /inventory/[itemId] detail route.
//
// REQUIREMENTS:
//   - INV-08 — detail page with stock breakdown + chronological transaction history
//   - INV-10 — QR label preview reachable from detail
//   - INV-05 — admin retire flow reachable from detail
//
// Next 16 — params is async (must be awaited). Same precedent as the edit
// route. The page is a Server Component; the interactive surfaces (print
// dialog, retire dialog, history feed) live in client islands.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSnapshot } from "@/lib/mock/store";
import { selectItemById } from "@/lib/mock/selectors";
import { getMockSession } from "@/lib/auth/mock-session";
import { ItemDetail } from "@/components/feature/inventory/ItemDetail";

type RouteProps = { params: Promise<{ itemId: string }> };

export async function generateMetadata({
  params,
}: RouteProps): Promise<Metadata> {
  const { itemId } = await params;
  const item = selectItemById(getSnapshot(), itemId);
  return { title: item ? item.name : "Item not found" };
}

export default async function ItemDetailPage({ params }: RouteProps) {
  const { itemId } = await params;
  const item = selectItemById(getSnapshot(), itemId);
  if (!item) notFound();
  const session = await getMockSession();
  const isAdmin = session?.role === "admin";
  return <ItemDetail item={item} isAdmin={isAdmin} />;
}
