// Zod schema for createCheckoutGroupAction input.
// quick-kayinleong-006 — post-checkout group barcode generation.
//
// Uses Zod 4 canonical constructors per D-01-01-C.

import { z } from "zod";

const CheckoutGroupItemLineSchema = z.object({
  itemId: z.string().min(1),
  itemSku: z.string().min(1),
  itemName: z.string().min(1),
  qty: z.number().int().positive(),
});

export const CreateCheckoutGroupInputSchema = z.object({
  eventId: z.string().min(1),
  txIds: z.array(z.string().min(1)).min(1),
  itemLines: z.array(CheckoutGroupItemLineSchema).min(1),
  label: z.string().min(1).max(120),
});

export type CreateCheckoutGroupInput = z.infer<
  typeof CreateCheckoutGroupInputSchema
>;
