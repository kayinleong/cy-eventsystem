// quick-kayinleong-001 — Delivery Order upload form (admin-only via the
// Server Action it calls). Generates the doId up front so the Storage path
// is known before the upload, then calls createDeliveryOrder once the file
// is in Storage and the user has chosen items.

"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  DeliveryOrderFormSchema,
  type DeliveryOrderFormInput,
} from "@/lib/schemas/delivery-order";
import type { InventoryItem } from "@/lib/types/item";
import type { DoUploadResult } from "@/lib/storage/upload-delivery-order";
import { createDeliveryOrder } from "@/app/(app)/delivery-orders/actions";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { InventoryItemMultiCombobox } from "@/components/feature/inventory/InventoryItemMultiCombobox";
import { DeliveryOrderUploadField } from "./DeliveryOrderUploadField";

type UploadedFile = DoUploadResult & { originalFilename: string };

export function DeliveryOrderForm({ items }: { items: InventoryItem[] }) {
  const router = useRouter();
  // Stable doc id per form instance — used as both the Storage path key
  // and the eventual Firestore doc id. Lazy state initializer so the
  // (impure) randomness only runs once on mount.
  const [doId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
  );
  const [submitting, setSubmitting] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<DeliveryOrderFormInput>({
    resolver: zodResolver(DeliveryOrderFormSchema),
    mode: "onBlur",
    defaultValues: {
      vendor: "",
      itemIds: [],
      notes: "",
    },
  });

  async function onSubmit(values: DeliveryOrderFormInput) {
    if (!uploaded) {
      setFileError("Upload a DO file first.");
      return;
    }
    setFileError(null);
    setSubmitting(true);
    try {
      const result = await createDeliveryOrder({
        doId,
        vendor: values.vendor,
        fileUrl: uploaded.url,
        filePath: uploaded.path,
        originalFilename: uploaded.originalFilename,
        contentType: uploaded.contentType,
        itemIds: values.itemIds,
        notes: values.notes ?? "",
      });
      if (!result.ok) {
        if (result.errors) {
          for (const [field, messages] of Object.entries(result.errors)) {
            if (messages && messages.length > 0) {
              setError(field as keyof DeliveryOrderFormInput, {
                type: "server",
                message: messages[0],
              });
            }
          }
        }
        toast.error(result.error ?? "Couldn't save delivery order.");
        return;
      }
      toast.success("Delivery order saved");
      router.push(`/delivery-orders/${result.doId}`);
      router.refresh();
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
        <Field data-invalid={!!errors.vendor}>
          <FieldLabel htmlFor="do-vendor">Vendor</FieldLabel>
          <Input
            id="do-vendor"
            placeholder="e.g. Acme Audio"
            aria-invalid={!!errors.vendor}
            {...register("vendor")}
          />
          <FieldError
            errors={
              errors.vendor ? [{ message: errors.vendor.message }] : undefined
            }
          />
        </Field>

        <Field data-invalid={!!fileError}>
          <FieldLabel>DO file (PDF, JPG, or PNG)</FieldLabel>
          <DeliveryOrderUploadField
            doId={doId}
            uploaded={uploaded}
            onUploaded={(u) => {
              setUploaded(u);
              if (u) setFileError(null);
            }}
            disabled={submitting}
          />
          {fileError ? (
            <FieldError errors={[{ message: fileError }]} />
          ) : null}
        </Field>

        <Field data-invalid={!!errors.itemIds}>
          <FieldLabel htmlFor="do-items">Items</FieldLabel>
          <Controller
            control={control}
            name="itemIds"
            render={({ field }) => (
              <InventoryItemMultiCombobox
                value={field.value ?? []}
                onChange={field.onChange}
                items={items}
              />
            )}
          />
          <FieldError
            errors={
              errors.itemIds
                ? [{ message: errors.itemIds.message }]
                : undefined
            }
          />
        </Field>

        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="do-notes">Notes</FieldLabel>
          <Textarea
            id="do-notes"
            rows={3}
            placeholder="Optional context (PO number, condition, …)"
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
        <Button type="submit" disabled={submitting || !uploaded}>
          Save delivery order
        </Button>
      </div>
    </form>
  );
}
