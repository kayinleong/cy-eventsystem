// Phase 2 — Shared ItemForm for /inventory/new (create) and
// /inventory/[id]/edit (Block C UI swap, plan 02-06).
//
// REQUIREMENTS:
//   - INV-01 — create item: name + sku + category + totalQty + unit + photoUrl
//     + notes + lowStockThreshold.
//   - INV-02 — SKU uniqueness enforced server-side in createItem
//     (tx.get(docRef).exists assert returns SKU_EXISTS); surfaced inline
//     via setError("sku", ...).
//   - INV-03 — edit item: same fields except sku + totalQty (locked).
//   - INV-04 — stock-adjust flow is the AdjustStockDialog; edit form does
//     NOT mutate totalQty.
//   - D-15 — UI surface amendment: BOTH /new AND /edit forms gain a photo
//     field (ItemPhotoField — file picker + Take photo) compared to Phase 1.
//
// Phase 2 swap from Phase 1:
//   - createItem / updateItem mock-store mutators → Server Actions from
//     app/(app)/inventory/actions.ts.
//   - Actor lookup (mock-user resolution + useCurrentUser) DELETED — Server
//     Actions derive actor from verifySession() server-side per CONTEXT.md.
//   - getSnapshot() SKU collision check DELETED — moved into the Server
//     Action's runTransaction (atomic, race-safe).
//   - photoUrl text input REPLACED with ItemPhotoField (D-15).
//   - router.refresh() after successful mutation (Server Action already
//     calls revalidatePath; client refresh is defense-in-depth).

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
import {
  createItem,
  updateItem,
} from "@/app/(app)/inventory/actions";
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
import { ItemPhotoField } from "./ItemPhotoField";

export type ItemFormProps =
  | { mode: "create"; initial?: ItemFormInput; itemId?: undefined }
  | { mode: "edit"; itemId: string; initial: ItemFormInput };

export function ItemForm(props: ItemFormProps) {
  const { mode, initial, itemId } = props;
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  // Photo URL is managed outside react-hook-form so the ItemPhotoField can
  // surface upload progress + permission errors via local state. The final
  // value is folded into the action payload at submit time.
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    initial?.photoUrl && initial.photoUrl !== "" ? initial.photoUrl : null,
  );

  const {
    register,
    handleSubmit,
    setError,
    control,
    watch,
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

  // For new items, the photo upload helper needs the itemId (== SKU). We
  // gate the ItemPhotoField until the user has entered a non-empty SKU.
  // For edit mode, the itemId is fixed and the photo field always renders.
  const skuValue = watch("sku") ?? "";
  const photoItemId =
    mode === "edit" && itemId ? itemId : skuValue.trim().toUpperCase();
  const photoEnabled = photoItemId.length > 0;

  async function onSubmit(values: ItemFormInput) {
    setSubmitting(true);
    try {
      if (mode === "create") {
        const res = await createItem({
          name: values.name,
          sku: values.sku.toUpperCase(),
          category: values.category,
          totalQty: values.totalQty,
          unit: values.unit ?? "pcs",
          notes: values.notes ?? "",
          lowStockThreshold: values.lowStockThreshold ?? 0,
          photoUrl: photoUrl ?? null,
        });
        if (!res.ok) {
          if (res.errors) {
            for (const [k, msgs] of Object.entries(res.errors)) {
              if (msgs && msgs.length > 0) {
                setError(k as keyof ItemFormInput, { message: msgs[0] });
              }
            }
          }
          // Surface non-field errors (e.g. SKU_EXISTS) inline + via toast.
          if (!res.errors || Object.keys(res.errors).length === 0) {
            toast.error(res.error ?? "Couldn't save — try again.");
          }
          return;
        }
        toast.success("Item added");
        router.push(`/inventory/${res.itemId}`);
        router.refresh();
      } else if (itemId) {
        const res = await updateItem(itemId, {
          name: values.name,
          category: values.category,
          unit: values.unit ?? "pcs",
          notes: values.notes ?? "",
          lowStockThreshold: values.lowStockThreshold ?? 0,
          photoUrl: photoUrl ?? null,
          // INV-04: totalQty NOT updated here — use AdjustStockDialog.
        });
        if (!res.ok) {
          if (res.errors) {
            for (const [k, msgs] of Object.entries(res.errors)) {
              if (msgs && msgs.length > 0) {
                setError(k as keyof ItemFormInput, { message: msgs[0] });
              }
            }
          }
          if (!res.errors || Object.keys(res.errors).length === 0) {
            toast.error(res.error ?? "Couldn't save — try again.");
          }
          return;
        }
        toast.success("Item updated");
        router.push(`/inventory/${itemId}`);
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
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

        {/* D-15: photo field on both /inventory/new and /inventory/[id]/edit.
            For NEW items, the SKU must be set first (the upload helper
            writes to items/{sku}/photo.jpg). For EDIT, itemId is fixed. */}
        <Field>
          <FieldLabel>Photo (optional)</FieldLabel>
          {photoEnabled ? (
            <ItemPhotoField
              itemId={photoItemId}
              initialUrl={photoUrl}
              onChange={setPhotoUrl}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter a SKU above to upload a photo.
            </p>
          )}
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
