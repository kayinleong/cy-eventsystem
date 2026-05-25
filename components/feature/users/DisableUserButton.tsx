// Phase 2 — User status toggle (Disable + Enable).
//
// REQUIREMENTS:
//   - AUTH-09 — admins can disable a user; disabled users lose access and
//     show a "Disabled" badge in the users list (rendered by UsersTable).
//     The disableUser Server Action revokes refresh tokens so existing
//     sessions die on next request; the DAL re-checks Firestore.disabled
//     on every authenticated request.
//   - Re-enable is supported (admin restores access by setting Auth.disabled
//     = false + Firestore.disabled = false). Non-destructive — no confirm
//     dialog. The re-enabled user must sign in fresh.
//   - UI-SPEC Q9 — destructive confirmation uses <AlertDialog/> (NOT <Dialog/>).
//     Title: "Disable this user?". Body: "They lose access immediately. Their
//     past activity stays in reports." Confirm label: "Disable user" (verb-noun,
//     never "OK").

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, UserCheck } from "lucide-react";
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
  const router = useRouter();

  function disable() {
    startTransition(async () => {
      const res = await disableUser(uid, true);
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't disable user");
        return;
      }
      toast(`${displayName} disabled`);
      router.refresh();
    });
  }

  function enable() {
    startTransition(async () => {
      const res = await disableUser(uid, false);
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't enable user");
        return;
      }
      toast.success(`${displayName} enabled`);
      router.refresh();
    });
  }

  if (alreadyDisabled) {
    // Re-enable is non-destructive — no confirm dialog. One-click action.
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={enable}
      >
        <UserCheck className="mr-2 size-4" />
        Enable
      </Button>
    );
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
          <AlertDialogAction variant="destructive" onClick={disable}>
            Disable user
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
