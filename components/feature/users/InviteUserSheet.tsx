// Phase 2 — Invite user Sheet for /users.
//
// REQUIREMENTS:
//   - AUTH-07 — admins invite a new user via email + role; Phase 2 fires a
//     real Firebase password-reset link via the inviteUser Server Action,
//     and returns the reset URL so the admin can copy/share manually
//     (CONTEXT.md D-09).
//   - UI-SPEC "Sheets vs Dialogs" Shared #8 — Sheet for the invite flow
//     (short form on the right rail). The dedicated /users/invite full-page
//     route exists in parallel; this Sheet is the in-context entry point
//     opened from the users list.
//   - AUTH-10 — admin-only: the sheet trigger returns null for non-admin
//     sessions so the "Invite user" CTA collapses on the staff view.
//
// Phase 1 used the mock store + a client-side actor lookup. Phase 2 calls
// the inviteUser Server Action which:
//   - derives the inviter server-side via requireAdmin();
//   - creates the Auth user + writes users/{uid} (Cloud Function 1 sets claims);
//   - returns the password-reset link in the response payload (D-09) so the
//     admin can Copy + share even if email delivery is shaky.

"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  InviteUserSchema,
  type InviteUserInput,
} from "@/lib/schemas/user";
import { inviteUser } from "@/app/(app)/users/actions";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

export function InviteUserSheet() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const session = useCurrentUser();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<InviteUserInput>({
    resolver: zodResolver(InviteUserSchema),
    mode: "onBlur",
    defaultValues: { email: "", displayName: "", role: "staff" },
  });

  if (session?.role !== "admin") return null;

  function onSubmit(values: InviteUserInput) {
    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("displayName", values.displayName);
    formData.set("role", values.role);

    startTransition(async () => {
      const res = await inviteUser(formData);
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't invite — try again.");
        return;
      }
      setResetLink(res.resetLink);
      toast.success("Invite created. Copy the link to share manually if email doesn't arrive.");
    });
  }

  function closeAndReset() {
    setOpen(false);
    setResetLink(null);
    setCopied(false);
    reset({ email: "", displayName: "", role: "staff" });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeAndReset();
        else setOpen(true);
      }}
    >
      <SheetTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Invite user
        </Button>
      </SheetTrigger>
      <SheetContent>
        {resetLink ? (
          <>
            <SheetHeader>
              <SheetTitle>Invite created</SheetTitle>
              <SheetDescription>
                Firebase will email this link automatically. If the recipient
                doesn&apos;t receive it, copy and share it directly.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-4 py-4">
              <code className="block rounded-md bg-muted p-3 text-xs break-all">
                {resetLink}
              </code>
              <Button
                onClick={async () => {
                  await navigator.clipboard.writeText(resetLink);
                  setCopied(true);
                  toast.success("Copied");
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="w-full"
              >
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setResetLink(null);
                  setCopied(false);
                  reset({ email: "", displayName: "", role: "staff" });
                }}
                className="w-full"
              >
                Invite another
              </Button>
            </div>
            <SheetFooter>
              <Button variant="ghost" onClick={closeAndReset}>
                Close
              </Button>
            </SheetFooter>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Invite user</SheetTitle>
              <SheetDescription>
                They&apos;ll receive a sign-in link.
              </SheetDescription>
            </SheetHeader>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-4 px-4 py-4"
              noValidate
            >
              <FieldGroup className="gap-4">
                <Field data-invalid={!!errors.email}>
                  <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                  <Input
                    id="invite-email"
                    type="email"
                    autoComplete="off"
                    aria-invalid={!!errors.email}
                    {...register("email")}
                  />
                  <FieldError
                    errors={
                      errors.email
                        ? [{ message: errors.email.message }]
                        : undefined
                    }
                  />
                </Field>

                <Field data-invalid={!!errors.displayName}>
                  <FieldLabel htmlFor="invite-displayName">Display name</FieldLabel>
                  <Input
                    id="invite-displayName"
                    autoComplete="off"
                    aria-invalid={!!errors.displayName}
                    {...register("displayName")}
                  />
                  <FieldError
                    errors={
                      errors.displayName
                        ? [{ message: errors.displayName.message }]
                        : undefined
                    }
                  />
                </Field>

                <Field data-invalid={!!errors.role}>
                  <FieldLabel htmlFor="invite-role">Role</FieldLabel>
                  <Controller
                    control={control}
                    name="role"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="invite-role" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError
                    errors={
                      errors.role ? [{ message: errors.role.message }] : undefined
                    }
                  />
                </Field>
              </FieldGroup>

              <SheetFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeAndReset}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Sending…" : "Send invite"}
                </Button>
              </SheetFooter>
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
