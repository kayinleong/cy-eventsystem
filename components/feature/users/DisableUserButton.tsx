// Phase 2 — Disable user destructive button.
//
// REQUIREMENTS:
//   - AUTH-09 — admins can disable a user; disabled users lose access and
//     show a "Disabled" badge in the users list (rendered by UsersTable).
//     The disableUser Server Action revokes refresh tokens so existing
//     sessions die on next request; the DAL re-checks Firestore.disabled
//     on every authenticated request.
//   - UI-SPEC Q9 — destructive confirmation uses <AlertDialog/> (NOT <Dialog/>).
//     Title: "Disable this user?". Body: "They lose access immediately. Their
//     past activity stays in reports." Confirm label: "Disable user" (verb-noun,
//     never "OK").
//
// Phase 1 used the mock store + a client-side actor lookup. Phase 2 calls
// the disableUser Server Action which derives the actor server-side via
// requireAdmin() — no client-side lookup, no actor arg.

"use client";

import { useTransition } from "react";
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
import { disableUser } from "@/app/(app)/users/actions";

export function DisableUserButton({
  uid,
  displayName,
  alreadyDisabled,
}: {
  uid: string;
  displayName: string;
  alreadyDisabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  if (alreadyDisabled) return null;

  function confirm() {
    startTransition(async () => {
      const res = await disableUser(uid, true);
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't disable user");
        return;
      }
      toast(`${displayName} disabled`);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={pending}>
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
