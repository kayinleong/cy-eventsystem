// Phase 1 — Disable user destructive button.
//
// REQUIREMENTS:
//   - AUTH-09 — admins can disable a user; disabled users lose access and
//     show a "Disabled" badge in the users list (rendered by UsersTable).
//   - UI-SPEC Q9 — destructive confirmation uses <AlertDialog/> (NOT <Dialog/>).
//     Title: "Disable this user?". Body: "They lose access immediately. Their
//     past activity stays in reports." Confirm label: "Disable user" (verb-noun,
//     never "OK").
//
// Per D-01-05-E actor-resolution pattern: useCurrentUser() gives the role/uid;
// resolve the full UserDoc from seedUsers at submit time; pass to mutator.
//
// Renders nothing when the user is already disabled — the table cell collapses
// cleanly without a tombstoned button.

"use client";

import { Ban } from "lucide-react";
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
import { disableUser } from "@/lib/mock/store";
import { seedUsers } from "@/lib/mock/users";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

export function DisableUserButton({
  uid,
  displayName,
  alreadyDisabled,
}: {
  uid: string;
  displayName: string;
  alreadyDisabled: boolean;
}) {
  const session = useCurrentUser();
  if (alreadyDisabled) return null;

  function confirm() {
    const actor = session
      ? seedUsers.find((u) => u.uid === session.uid)
      : undefined;
    if (!actor) {
      toast.error("Couldn't disable user");
      return;
    }
    disableUser(uid, actor);
    toast(`${displayName} disabled`);
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Ban className="mr-2 size-4" />
          Disable
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disable this user?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose access immediately. Their past activity stays in reports.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm}>
            Disable user
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
