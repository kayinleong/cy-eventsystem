// Phase 1 — /users/invite full-page invite form.
//
// REQUIREMENTS:
//   - AUTH-07 — admin invites a new user via email + display name + role.
//     This is the dedicated /users/invite route (parallel entry to the
//     InviteUserSheet on /users). Both call store.inviteUser with the same
//     payload + actor-resolution pattern; only the chrome differs (Sheet vs
//     full page card).
//
// UI-SPEC "Layout & Route Patterns" calls out `/users/new` (invite) as a
// "Full-page route" alongside `/inventory/new` and `/events/new`. The Sheet
// in /users is the in-context shortcut; this route is the form-bookmarkable
// URL for AUTH-07 deep-linking.
//
// Form composition uses shadcn v4 <Field> primitives + rhf register/Controller
// per D-01-04-B / D-01-06-A / D-01-07-A / D-01-11-B — the legacy <Form> /
// <FormField> Context wrapper does NOT exist in the v4 radix-nova registry,
// so we never import from `@/components/ui/form`.
//
// Actor-resolution pattern from Plan 05 D-01-05-E: read useCurrentUser() for
// the role/uid, resolve the full UserDoc from seedUsers at submit time, call
// store.inviteUser with the resolved actor.

"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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

export function InviteUserPageForm() {
  const router = useRouter();
  const session = useCurrentUser();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<InviteUserInput>({
    resolver: zodResolver(InviteUserSchema),
    mode: "onBlur",
    defaultValues: { email: "", displayName: "", role: "staff" },
  });

  function onSubmit(values: InviteUserInput) {
    const actor = session
      ? seedUsers.find((u) => u.uid === session.uid)
      : undefined;
    if (!actor) {
      toast.error("Couldn't invite user");
      return;
    }
    inviteUser(values, actor);
    toast.success("User invited");
    router.push("/users");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
    >
      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="invite-page-email">Email</FieldLabel>
          <Input
            id="invite-page-email"
            type="email"
            autoComplete="off"
            placeholder="teammate@example.com"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <FieldError
            errors={
              errors.email ? [{ message: errors.email.message }] : undefined
            }
          />
        </Field>

        <Field data-invalid={!!errors.displayName}>
          <FieldLabel htmlFor="invite-page-displayName">Display name</FieldLabel>
          <Input
            id="invite-page-displayName"
            autoComplete="off"
            placeholder="Sam Patel"
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
          <FieldLabel htmlFor="invite-page-role">Role</FieldLabel>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="invite-page-role" className="w-full">
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

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit">Send invite</Button>
      </div>
    </form>
  );
}
