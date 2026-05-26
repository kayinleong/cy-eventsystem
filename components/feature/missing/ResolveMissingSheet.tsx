// Phase 2 — Resolve Missing item Sheet.
//
// REQUIREMENTS:
//   - MIS-02 — admin resolves an open missing-item record from /reports/missing.
//   - MIS-03 — resolution is either `found` (returns qty to availableQty) or
//     `writtenOff` (decrements totalQty).
//   - MIS-04 — resolution writes a follow-up adjustment transaction (handled
//     inside resolveMissing Server Action / Plan 02-09).
//   - UI-SPEC "Sheets vs Dialogs" (Shared #8) — Sheet for the resolve flow
//     (multi-field form on the right rail).
//
// Phase 2 change: swap `store.resolveMissing` (mock) → `resolveMissing`
// Server Action from app/(app)/reports/missing/actions.ts. The Action enforces
// requireAdmin() server-side AND firestore.rules denies all missingItems
// client writes, so the only way to resolve is via this Sheet (defense in
// depth). useTransition wraps the call so the form shows pending state;
// router.refresh() after success forces revalidatePath to surface on the
// table immediately (defense-in-depth vs. live-listener latency).
//
// Form composition uses shadcn v4 <Field> primitives + rhf register/Controller
// per D-01-04-B / D-01-06-A / D-01-07-A.
//
// AUTH-10 / MIS-03 — admin-only: the sheet returns null for non-admin sessions
// (matching Phase 1 behavior). The server action also rejects non-admin
// callers, but client-side hiding the button keeps the UI tidy.

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { resolveMissing } from "@/app/(app)/reports/missing/actions";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

export function ResolveMissingSheet({
  missingId,
  itemName,
}: {
  missingId: string;
  itemName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
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
    // Server Action enforces admin role + missingItems doc existence +
    // not-already-resolved invariants. The Sheet shows the result via
    // toast and closes on success.
    startTransition(async () => {
      const result = await resolveMissing({
        missingId: values.missingId,
        resolution: values.resolution,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        values.resolution === "found" ? "Marked as found" : "Written off",
      );
      setOpen(false);
      reset({ missingId, resolution: "found", notes: "" });
      // Defense-in-depth: revalidatePath in the Server Action handles
      // SSR re-fetch, but useMissingLive subscribes on the client too.
      // router.refresh() bridges any window between the listener update
      // and the user navigating away.
      router.refresh();
    });
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
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Resolving…" : "Confirm"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
