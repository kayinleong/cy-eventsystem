// Phase 2 — Destructive confirm to retire an inventory item (Block C UI swap).
//
// REQUIREMENTS:
//   - INV-05 — admins can retire items (soft delete: lifecycleState=retired).
//   - AUTH-10 — staff never see this button (admin-only at the UI layer).
//   - PITFALLS C5 — Server Action refuses retire when outQty > 0; surface
//     the ITEM_OUT error via toast so the admin understands why.
//
// UI-SPEC locked copy (Q9 destructive confirmations table):
//   - Title: "Retire this item?"
//   - Body:  "It will be removed from active inventory and won't appear in
//             scans or events. Past history is kept."
//   - Confirm label: "Retire item"
//
// Phase 2 swap from Phase 1:
//   - retireItem mock-store mutator → Server Action from
//     app/(app)/inventory/actions.ts. Actor lookup (mock-user resolution +
//     useCurrentUser) DELETED — Server Action derives actor server-side.
//   - Surface ITEM_OUT and ITEM_NOT_FOUND errors via toast.error.
//   - router.refresh() after success (Server Action's revalidatePath
//     already invalidates the route; refresh is defense-in-depth).

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { retireItem } from "@/app/(app)/inventory/actions";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

export function RetireItemButton({
  itemId,
  itemName,
}: {
  itemId: string;
  itemName: string;
}) {
  const router = useRouter();
  const session = useCurrentUser();
  const [pending, startTransition] = useTransition();

  // Defense-in-depth at the UI layer; the Server Action enforces admin via
  // requireAdmin(). This button can render inside a detail page that any
  // signed-in user can reach, so we gate at render too.
  if (session?.role !== "admin") return null;

  function confirmRetire() {
    startTransition(async () => {
      const res = await retireItem(itemId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${itemName} retired`);
      router.push("/inventory");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="mr-2 size-4" /> Retire
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retire this item?</AlertDialogTitle>
          <AlertDialogDescription>
            It will be removed from active inventory and won&apos;t appear in
            scans or events. Past history is kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={confirmRetire}
            disabled={pending}
          >
            {pending ? "Retiring…" : "Retire item"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
