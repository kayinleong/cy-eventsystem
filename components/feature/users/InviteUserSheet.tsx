// Phase 1 — Invite user Sheet for /users.
//
// REQUIREMENTS:
//   - AUTH-07 — admins invite a new user via email + role; Phase 1 creates the
//     UserDoc directly (Phase 2 fires a Firebase password-reset link).
//   - UI-SPEC "Sheets vs Dialogs" Shared #8 — Sheet for the invite flow
//     (short form on the right rail). The dedicated /users/invite full-page
//     route exists in parallel (per AUTH-07 + plan Task 2); this Sheet is the
//     in-context entry point opened from the users list.
//
// Form composition uses shadcn v4 <Field> primitives + rhf register/Controller
// per D-01-04-B / D-01-06-A / D-01-07-A / D-01-11-B — the legacy <Form> /
// <FormField> Context wrapper does NOT exist in the v4 radix-nova registry
// (the form entry is empty), so we never import from `@/components/ui/form`.
//
// Actor-resolution pattern from Plan 05 D-01-05-E: read useCurrentUser() for
// the role/uid, resolve the full UserDoc from seedUsers at submit time, call
// store.inviteUser with the resolved actor.
//
// AUTH-10 — admin-only: the sheet trigger returns null for non-admin sessions
// so the "Invite user" CTA collapses on the staff view (UsersTable still
// renders the row above + empty-state below correctly).

"use client";

import { useState } from "react";
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
import { inviteUser } from "@/lib/mock/store";
import { seedUsers } from "@/lib/mock/users";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

export function InviteUserSheet() {
  const [open, setOpen] = useState(false);
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
    const actor = session
      ? seedUsers.find((u) => u.uid === session.uid)
      : undefined;
    if (!actor) {
      toast.error("Couldn't invite user");
      return;
    }
    // Phase 1: store records the user immediately; Phase 2 sends Firebase
    // password-reset link.
    inviteUser(values, actor);
    toast.success("User invited");
    setOpen(false);
    reset({ email: "", displayName: "", role: "staff" });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Invite user
        </Button>
      </SheetTrigger>
      <SheetContent>
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
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Send invite</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
