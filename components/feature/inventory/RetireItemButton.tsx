// Phase 1 — Destructive confirm to retire an inventory item.
//
// REQUIREMENTS:
//   - INV-05 — admins can retire items (soft delete: lifecycleState = "retired").
//   - AUTH-10 — staff never see this button (admin-only at the UI layer).
//
// UI-SPEC locked copy (Q9 destructive confirmations table):
//   - Title: "Retire this item?"
//   - Body:  "It will be removed from active inventory and won't appear in
//             scans or events. Past history is kept."
//   - Confirm label: "Retire item"
//
// Toast pattern: "Item retired" (UI-SPEC action toast verb-noun-past-tense).

"use client";

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
import { retireItem } from "@/lib/mock/store";
import { seedUsers } from "@/lib/mock/users";
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

  // Defense-in-depth at the UI layer; the layout-level requireAdmin() on the
  // edit/new routes is the server gate. This button can render inside a
  // detail page that ANY signed-in user can reach, so we must gate at render.
  if (session?.role !== "admin") return null;

  function confirmRetire() {
    const actor = seedUsers.find((u) => u.uid === session?.uid);
    if (!actor) {
      toast.error("Couldn't retire item");
      return;
    }
    retireItem(itemId, actor);
    toast(`${itemName} retired`);
    router.push("/inventory");
    router.refresh();
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
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={confirmRetire}
          >
            Retire item
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
