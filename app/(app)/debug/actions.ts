"use server";

import { requireAdmin } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { revalidatePath } from "next/cache";

const CLEARABLE_COLLECTIONS = [
  "inventory",
  "events",
  "transactions",
  "deliveryOrders",
  "checkoutGroups",
  "missingItems",
] as const;

async function deleteCollection(name: string): Promise<void> {
  const BATCH = 500;
  for (;;) {
    const snap = await adminDb.collection(name).limit(BATCH).get();
    if (snap.empty) break;
    const batch = adminDb.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (snap.docs.length < BATCH) break;
  }
}

export async function clearAllDataAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  await requireAdmin();
  try {
    await Promise.all(CLEARABLE_COLLECTIONS.map(deleteCollection));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
