// Phase 1 — Resolve Missing item Sheet.
//
// REQUIREMENTS:
//   - MIS-02 — admin resolves an open missing-item record from /reports/missing.
//   - MIS-03 — resolution is either `found` (returns qty to availableQty) or
//     `writtenOff` (decrements totalQty).
//   - MIS-04 — resolution writes a follow-up adjustment transaction (handled
//     inside store.resolveMissing).
//   - UI-SPEC "Sheets vs Dialogs" (Shared #8) — Sheet for the resolve flow
//     (multi-field form on the right rail).
//
// Form composition uses shadcn v4 <Field> primitives + rhf register/Controller
// per D-01-04-B / D-01-06-A / D-01-07-A — the legacy <Form> / <FormField>
// Context wrapper does NOT exist in the v4 radix-nova registry (the form entry
// is empty), so we never import from `@/components/ui/form`.
//
// Actor-resolution pattern from Plan 05 D-01-05-E: read useCurrentUser() for
// the role/uid, resolve the full UserDoc from seedUsers at submit time, call
// store.resolveMissing with the resolved actor.
//
// AUTH-10 / MIS-03 — admin-only: the sheet returns null for non-admin sessions.

"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ResolveMissingSchema,
  type ResolveMissingInput,
} from "@/lib/schemas/missing-item";
import { resolveMissing } from "@/lib/mock/store";
import { seedUsers } from "@/lib/mock/users";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

export function ResolveMissingSheet({
  missingId,
  itemName,
}: {
  missingId: string;
  itemName: string;
}) {
  const [open, setOpen] = useState(false);
  const session = useCurrentUser();

  const {
    handleSubmit,
    control,
    register,
    reset,
    formState: { errors },
  } = useForm<ResolveMissingInput>({
    resolver: zodResolver(ResolveMissingSchema),
    defaultValues: { missingId, resolution: "found", notes: "" },
  });

  // AUTH-10 / MIS-03 — admin-only. Render nothing for staff so the table column
  // collapses cleanly.
  if (session?.role !== "admin") return null;

  function onSubmit(values: ResolveMissingInput) {
    const actor = session
      ? seedUsers.find((u) => u.uid === session.uid)
      : undefined;
    if (!actor) {
      toast.error("Couldn't resolve");
      return;
    }
    resolveMissing(values.missingId, values.resolution, actor);
    toast.success(
      values.resolution === "found" ? "Marked as found" : "Written off",
    );
    setOpen(false);
    reset({ missingId, resolution: "found", notes: "" });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          Resolve
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Resolve missing</SheetTitle>
          <SheetDescription>
            Decide what happens to {itemName}.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 px-4 py-4"
          noValidate
        >
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.resolution}>
              <FieldLabel>Resolution</FieldLabel>
              <Controller
                control={control}
                name="resolution"
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="space-y-2"
                  >
                    <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                      <RadioGroupItem value="found" />
                      <div>
                        <p className="text-sm font-medium">Found</p>
                        <p className="text-xs text-muted-foreground">
                          Return quantity to available stock.
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                      <RadioGroupItem value="writtenOff" />
                      <div>
                        <p className="text-sm font-medium">Write off</p>
                        <p className="text-xs text-muted-foreground">
                          Decrement total quantity. Permanent.
                        </p>
                      </div>
                    </label>
                  </RadioGroup>
                )}
              />
              <FieldError
                errors={
                  errors.resolution
                    ? [{ message: errors.resolution.message }]
                    : undefined
                }
              />
            </Field>

            <Field data-invalid={!!errors.notes}>
              <FieldLabel htmlFor="resolve-notes">Notes (optional)</FieldLabel>
              <Textarea
                id="resolve-notes"
                rows={3}
                aria-invalid={!!errors.notes}
                {...register("notes")}
              />
              <FieldError
                errors={
                  errors.notes
                    ? [{ message: errors.notes.message }]
                    : undefined
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
            <Button type="submit">Confirm</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
