// Phase 2 — Stock adjustment dialog (Block C, plan 02-06).
//
// REQUIREMENTS:
//   - INV-04 — admin can adjust totalQty (and matching availableQty) with a
//     required reason. The Server Action wraps the update + audit-row write
//     in a single Firestore transaction (INT-01 atomic invariant).
//   - AUD-01 — every adjustment writes a transactions row with the actor +
//     reason snapshot.
//   - PITFALLS C1 — `adjustItemStock` rejects WOULD_GO_NEGATIVE deltas
//     server-side; surface the error via toast so the admin can adjust.
//
// Phase 2 NEW component — no Phase 1 analog. Wired into ItemDetail (admin-
// only). Calls adjustItemStock Server Action.

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wrench } from "lucide-react";
import { toast } from "sonner";

import { adjustItemStock } from "@/app/(app)/inventory/actions";
import { AdjustStockSchema, type AdjustStockInput } from "@/lib/schemas/item";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";

// Common adjustment reasons surfaced as presets. "Other" reveals a free-text
// textarea for cases that don't fit a preset. The action requires a non-empty
// reason string (AdjustStockSchema.reason.min(1)).
const REASON_PRESETS = [
  "Damaged in transit",
  "Damaged on return",
  "Lost / written off",
  "Found extra",
  "Annual count correction",
  "Vendor warranty replacement",
  "Other",
] as const;

type FormShape = {
  delta: number;
  reasonPreset: string;
  reasonOther: string;
};

export function AdjustStockDialog({
  itemId,
  itemName,
  currentAvailable,
  currentTotal,
}: {
  itemId: string;
  itemName: string;
  currentAvailable: number;
  currentTotal: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormShape>({
    defaultValues: {
      delta: 0,
      reasonPreset: REASON_PRESETS[0],
      reasonOther: "",
    },
  });

  const reasonPreset = watch("reasonPreset");
  const isOther = reasonPreset === "Other";

  function onSubmit(values: FormShape) {
    const reason = isOther ? values.reasonOther.trim() : values.reasonPreset;
    // Client-side guard for AdjustStockSchema's reason.min(1) + delta!=0.
    const payload: AdjustStockInput = {
      itemId,
      delta: Number(values.delta),
      reason,
    };
    const parsed = AdjustStockSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      if (fieldErrors.delta?.[0]) {
        setError("delta", { message: fieldErrors.delta[0] });
      }
      if (fieldErrors.reason?.[0]) {
        setError(isOther ? "reasonOther" : "reasonPreset", {
          message: fieldErrors.reason[0],
        });
      }
      return;
    }

    startTransition(async () => {
      const res = await adjustItemStock(parsed.data);
      if (!res.ok) {
        // Surface WOULD_GO_NEGATIVE / ITEM_NOT_FOUND via toast.
        toast.error(res.error);
        return;
      }
      toast.success("Stock adjusted");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Wrench className="mr-2 size-4" /> Adjust stock
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock — {itemName}</DialogTitle>
          <DialogDescription>
            Current available {currentAvailable} of {currentTotal} total. Enter
            a positive delta to add stock; negative to remove. The change is
            recorded in the audit log with your reason.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.delta}>
              <FieldLabel htmlFor="adjust-delta">Delta (±)</FieldLabel>
              <Input
                id="adjust-delta"
                type="number"
                inputMode="numeric"
                step={1}
                aria-invalid={!!errors.delta}
                {...register("delta", { valueAsNumber: true })}
              />
              <FieldError
                errors={
                  errors.delta
                    ? [{ message: errors.delta.message }]
                    : undefined
                }
              />
            </Field>

            <Field data-invalid={!!errors.reasonPreset}>
              <FieldLabel htmlFor="adjust-reason">Reason</FieldLabel>
              <Controller
                control={control}
                name="reasonPreset"
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger id="adjust-reason" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REASON_PRESETS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError
                errors={
                  errors.reasonPreset
                    ? [{ message: errors.reasonPreset.message }]
                    : undefined
                }
              />
            </Field>

            {isOther ? (
              <Field data-invalid={!!errors.reasonOther}>
                <FieldLabel htmlFor="adjust-reason-other">
                  Specify reason
                </FieldLabel>
                <Textarea
                  id="adjust-reason-other"
                  rows={3}
                  placeholder="Describe the adjustment…"
                  aria-invalid={!!errors.reasonOther}
                  {...register("reasonOther", {
                    required: "Reason is required.",
                  })}
                />
                <FieldError
                  errors={
                    errors.reasonOther
                      ? [{ message: errors.reasonOther.message }]
                      : undefined
                  }
                />
              </Field>
            ) : null}
          </FieldGroup>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Adjusting…" : "Adjust stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
