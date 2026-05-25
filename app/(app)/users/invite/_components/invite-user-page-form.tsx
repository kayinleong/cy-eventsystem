// Phase 2 — /users/invite full-page invite form.
//
// REQUIREMENTS:
//   - AUTH-07 — admin invites a new user via email + display name + role.
//     This is the dedicated /users/invite route (parallel entry to the
//     InviteUserSheet on /users). Both call inviteUser() Server Action;
//     only the chrome differs (Sheet vs full page card).
//   - CONTEXT.md D-09 — show password-reset link with Copy button after
//     successful invite (both on success and partial-failure paths) so
//     admin can share the link directly if email delivery is shaky.
//
// Form composition uses shadcn v4 <Field> primitives + rhf register/Controller
// per Phase 1 D-01-04-B. Phase 2 replaces the mock-store inviteUser call with
// the Server Action; on success, swap the form chrome for a "Copy link" panel.

"use client";

import { useState, useTransition } from "react";
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
import { inviteUser } from "@/app/(app)/users/actions";

export function InviteUserPageForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  function onSubmit(values: InviteUserInput) {
    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("displayName", values.displayName);
    formData.set("role", values.role);

    startTransition(async () => {
      const result = await inviteUser(formData);
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't invite — try again.");
        return;
      }
      setResetLink(result.resetLink);
      toast.success("Invite created. Copy the link to share manually if email doesn't arrive.");
    });
  }

  if (resetLink) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold">Invite created</h3>
          <p className="text-sm text-muted-foreground">
            Firebase will email this link automatically. If the recipient
            doesn&apos;t receive it, copy and share it directly.
          </p>
        </div>
        <code className="block rounded-md bg-muted p-3 text-xs break-all">
          {resetLink}
        </code>
        <div className="flex flex-col gap-2">
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
              reset({ email: "", displayName: "", role: "staff" });
            }}
            className="w-full"
          >
            Invite another
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push("/users")}
            className="w-full"
          >
            Back to users
          </Button>
        </div>
      </div>
    );
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
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}
