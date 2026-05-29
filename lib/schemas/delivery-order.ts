import { z } from "zod";

// Allowed content types mirror the storage.rules allowlist for
// delivery-orders/{doId}/document.{ext} — PDF, JPEG, PNG only.
export const DeliveryOrderContentTypeEnum = z.enum([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

// Full DO doc — used by reads at the boundary and as the server-action
// write payload (audit fields are added inside the action).
export const DeliveryOrderSchema = z.object({
  id: z.string().min(1),
  vendor: z.string().min(1).max(200),
  fileUrl: z.url(),
  filePath: z.string().min(1),
  originalFilename: z.string().min(1).max(255),
  contentType: DeliveryOrderContentTypeEnum,
  itemIds: z.array(z.string().min(1)).min(1),
  notes: z.string().max(2000).default(""),
  uploadedAt: z.string(),
  uploadedBy: z.string().min(1),
});

// Server-action input — admin uploads the file client-side, then calls
// createDeliveryOrder with the file metadata + chosen items + vendor.
// The action itself fills uploadedAt and uploadedBy from the session.
export const CreateDeliveryOrderSchema = z.object({
  doId: z.string().min(1),
  vendor: z.string().min(1, "Vendor is required.").max(200),
  fileUrl: z.url(),
  filePath: z.string().min(1),
  originalFilename: z.string().min(1).max(255),
  contentType: DeliveryOrderContentTypeEnum,
  itemIds: z.array(z.string().min(1)).min(1, "Pick at least one item."),
  notes: z.string().max(2000).default(""),
});

// Client form schema — the form drives file upload separately; vendor +
// itemIds + notes are the only react-hook-form-managed fields.
export const DeliveryOrderFormSchema = z.object({
  vendor: z.string().min(1, "Vendor is required.").max(200),
  itemIds: z.array(z.string().min(1)).min(1, "Pick at least one item."),
  notes: z.string().max(2000).default(""),
});

export type DeliveryOrderInput = z.input<typeof DeliveryOrderSchema>;
export type CreateDeliveryOrderInput = z.input<typeof CreateDeliveryOrderSchema>;
export type DeliveryOrderFormInput = z.input<typeof DeliveryOrderFormSchema>;
