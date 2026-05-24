// Phase 1 — Shared ItemForm for /inventory/new (create) and /inventory/[id]/edit.
//
// Uses shadcn v4 <Field> primitives per Plans 01 (D-01-01-A) + 04 (D-01-04-B):
// the legacy v3 <Form> / <FormField> Context wrapper is empty in the radix-nova
// registry. We bind react-hook-form's `register` / `setValue` directly to the
// shadcn primitives inside <Field>.
//
// REQUIREMENTS:
//   - INV-01 — create item: name + sku + category + totalQty + unit + photoUrl + notes + lowStockThreshold.
//   - INV-02 — SKU uniqueness enforced client-side via getSnapshot() lookup.
//   - INV-03 — edit item: same fields except sku + totalQty (locked).
//   - INV-04 — stock-adjust flow is Phase 2; edit form does NOT mutate totalQty.

"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ItemFormSchema,
  ItemCategoryEnum,
  type ItemFormInput,
} from "@/lib/schemas/item";
import { createItem, updateItem, getSnapshot } from "@/lib/mock/store";
import { seedUsers } from "@/lib/mock/users";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type ItemFormProps =
  | { mode: "create"; initial?: ItemFormInput; itemId?: undefined }
  | { mode: "edit"; itemId: string; initial: ItemFormInput };

export function ItemForm(props: ItemFormProps) {
  const { mode, initial, itemId } = props;
  const router = useRouter();
  const session = useCurrentUser();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<ItemFormInput>({
    resolver: zodResolver(ItemFormSchema),
    mode: "onBlur",
    defaultValues:
      initial ?? {
        name: "",
        sku: "",
        category: "Audio",
        totalQty: 0,
        unit: "pcs",
        photoUrl: "",
        notes: "",
        lowStockThreshold: 0,
      },
  });

  function onSubmit(values: ItemFormInput) {
    const actor = session
      ? seedUsers.find((u) => u.uid === session.uid)
      : undefined;
    if (!actor) {
      toast.error("Couldn't save changes");
      return;
    }

    // Normalize photoUrl: schema accepts URL | null | "" — store wants string|null.
    const normalizedPhotoUrl =
      values.photoUrl && values.photoUrl !== "" ? values.photoUrl : null;

    if (mode === "create") {
      // INV-02 — SKU uniqueness check before mutating.
      const existing = getSnapshot().items.find(
        (i) => i.sku.toLowerCase() === values.sku.toLowerCase(),
      );
      if (existing) {
        setError("sku", {
          message: "An item with this SKU already exists.",
        });
        return;
      }
      setSubmitting(true);
      const created = createItem(
        {
          name: values.name,
          sku: values.sku.toUpperCase(),
          category: values.category,
          totalQty: values.totalQty,
          unit: values.unit ?? "pcs",
          photoUrl: normalizedPhotoUrl,
          notes: values.notes ?? "",
          lowStockThreshold: values.lowStockThreshold ?? 0,
        },
        actor,
      );
      toast.success("Item added");
      // PROJECT.md key decision #14 — id === sku, so route via the new id.
      router.push(`/inventory/${created.id}`);
      router.refresh();
    } else if (itemId) {
      setSubmitting(true);
      updateItem(
        itemId,
        {
          name: values.name,
          category: values.category,
          unit: values.unit ?? "pcs",
          photoUrl: normalizedPhotoUrl,
          notes: values.notes ?? "",
          lowStockThreshold: values.lowStockThreshold ?? 0,
          // INV-04: totalQty intentionally NOT updated here — adjusting stock
          // requires the dedicated stock-adjust flow (Phase 2 surface).
        },
        actor,
      );
      toast.success("Item updated");
      router.push(`/inventory/${itemId}`);
      router.refresh();
    }
    setSubmitting(false);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 max-w-2xl"
      noValidate
    >
      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="item-name">Name</FieldLabel>
          <Input
            id="item-name"
            placeholder="e.g. Shure SM58 wireless mic"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          <FieldError
            errors={
              errors.name ? [{ message: errors.name.message }] : undefined
            }
          />
        </Field>

        <Field data-invalid={!!errors.sku}>
          <FieldLabel htmlFor="item-sku">SKU</FieldLabel>
          <Input
            id="item-sku"
            className="font-mono"
            placeholder="AUD-MIC-XX"
            disabled={mode === "edit"}
            aria-invalid={!!errors.sku}
            {...register("sku")}
          />
          <FieldError
            errors={errors.sku ? [{ message: errors.sku.message }] : undefined}
          />
        </Field>

        <Field data-invalid={!!errors.category}>
          <FieldLabel htmlFor="item-category">Category</FieldLabel>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="item-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ItemCategoryEnum.options.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError
            errors={
              errors.category
                ? [{ message: errors.category.message }]
                : undefined
            }
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!errors.totalQty}>
            <FieldLabel htmlFor="item-totalQty">Total quantity</FieldLabel>
            <Input
              id="item-totalQty"
              type="number"
              inputMode="numeric"
              disabled={mode === "edit"}
              aria-invalid={!!errors.totalQty}
              {...register("totalQty", { valueAsNumber: true })}
            />
            <FieldError
              errors={
                errors.totalQty
                  ? [{ message: errors.totalQty.message }]
                  : undefined
              }
            />
          </Field>

          <Field data-invalid={!!errors.unit}>
            <FieldLabel htmlFor="item-unit">Unit</FieldLabel>
            <Input
              id="item-unit"
              placeholder="pcs"
              aria-invalid={!!errors.unit}
              {...register("unit")}
            />
            <FieldError
              errors={
                errors.unit ? [{ message: errors.unit.message }] : undefined
              }
            />
          </Field>
        </div>

        <Field data-invalid={!!errors.lowStockThreshold}>
          <FieldLabel htmlFor="item-lowStockThreshold">
            Low-stock threshold
          </FieldLabel>
          <Input
            id="item-lowStockThreshold"
            type="number"
            inputMode="numeric"
            aria-invalid={!!errors.lowStockThreshold}
            {...register("lowStockThreshold", { valueAsNumber: true })}
          />
          <FieldError
            errors={
              errors.lowStockThreshold
                ? [{ message: errors.lowStockThreshold.message }]
                : undefined
            }
          />
        </Field>

        <Field data-invalid={!!errors.photoUrl}>
          <FieldLabel htmlFor="item-photoUrl">Photo URL (optional)</FieldLabel>
          <Input
            id="item-photoUrl"
            type="url"
            placeholder="https://..."
            aria-invalid={!!errors.photoUrl}
            {...register("photoUrl")}
          />
          <FieldError
            errors={
              errors.photoUrl
                ? [{ message: errors.photoUrl.message }]
                : undefined
            }
          />
        </Field>

        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="item-notes">Notes</FieldLabel>
          <Textarea
            id="item-notes"
            rows={4}
            aria-invalid={!!errors.notes}
            {...register("notes")}
          />
          <FieldError
            errors={
              errors.notes ? [{ message: errors.notes.message }] : undefined
            }
          />
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {mode === "create" ? "Add item" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
