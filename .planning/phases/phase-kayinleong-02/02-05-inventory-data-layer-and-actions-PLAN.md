---
phase: phase-kayinleong-02
plan: 05
type: execute
wave: 5
depends_on:
  - 02
  - 03
files_modified:
  - lib/data/inventory.server.ts
  - lib/hooks/use-inventory-live.ts
  - lib/storage/upload-photo.ts
  - lib/types/item.ts
  - lib/schemas/item.ts
  - app/(app)/inventory/actions.ts
  - package.json
autonomous: true
requirements:
  - INV-01
  - INV-02
  - INV-03
  - INV-04
  - INV-05
  - INV-06
  - INV-07
  - INV-08
  - INV-09
  - INT-01
  - INT-03
  - INT-04
  - NFR-06
  - RP-01

must_haves:
  truths:
    - "lib/data/inventory.server.ts ships getInventoryPage + getItemServer cursor-paged Admin SDK helpers."
    - "lib/hooks/use-inventory-live.ts ships onSnapshot-backed reactive hook scoped to 50-row visible window per D-20."
    - "lib/storage/upload-photo.ts compresses via browser-image-compression then uploads to items/{itemId}/photo.jpg."
    - "InventoryItem type extended with isLowStock: boolean (RP-02 / D-21 derived field per RESEARCH P11)."
    - "Server Actions in app/(app)/inventory/actions.ts: createItem, updateItem, retireItem, adjustItemStock, updateLowStockThreshold, markLowStockOrdered."
    - "Every mutation that changes availableQty or lowStockThreshold writes isLowStock atomically inside the transaction (RESEARCH P11)."
    - "createItem uses runTransaction with tx.get(docRef) → existing.exists assertion for INV-02 SKU uniqueness."
    - "adjustItemStock writes a 'transactions' audit row with type='adjustment' + actor snapshot + required reason."
    - "retireItem sets lifecycleState='retired' and writes an audit row (INV-05 + AUD-01)."
    - "Every action calls revalidatePath('/inventory'), '/' (dashboard KPIs), and '/inventory/[itemId]' as appropriate."
  artifacts:
    - path: "lib/data/inventory.server.ts"
      provides: "getInventoryPage(opts) + getItemServer(itemId) cursor-paged Admin SDK reads"
      contains: "startAfter"
    - path: "lib/hooks/use-inventory-live.ts"
      provides: "Live hook scoped to cursor page slice per D-20"
      contains: "onSnapshot"
    - path: "lib/storage/upload-photo.ts"
      provides: "Compress + upload to items/{itemId}/photo.jpg per D-11..D-14"
      contains: "browser-image-compression"
    - path: "app/(app)/inventory/actions.ts"
      provides: "6 Server Actions per inventory mutator → Server Action 1:1 map"
      contains: "runTransaction"
    - path: "lib/types/item.ts"
      provides: "InventoryItem extended with isLowStock: boolean"
      contains: "isLowStock"
  key_links:
    - from: "app/(app)/inventory/actions.ts (every mutator)"
      to: "Firestore inventory + transactions collections"
      via: "runTransaction wraps every stock change; writes transactions audit row + updates isLowStock"
      pattern: "runTransaction.*isLowStock"
    - from: "lib/data/inventory.server.ts"
      to: "Server Components in /inventory and /inventory/[itemId]"
      via: "SSR seed pattern; client hook takes over via onSnapshot"
      pattern: "getInventoryPage"
---

<objective>
**Block C — Inventory CRUD (data layer + actions).** Ship the Admin SDK read helpers, the Web SDK live hook, the photo upload helper, and 6 Server Actions covering all inventory mutations. Critical denormalization per RESEARCH P11: `isLowStock` is updated atomically in every action that touches `availableQty` or `lowStockThreshold` — required because Firestore `where()` cannot compare two fields.

Output: 7 files. UI wiring (forms, photo field, table) lands in 02-06.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@.planning/phases/phase-kayinleong-02/02-CONTEXT.md
@.planning/phases/phase-kayinleong-02/02-RESEARCH.md
@.planning/phases/phase-kayinleong-02/02-PATTERNS.md
@.planning/phases/phase-kayinleong-02/02-02-firebase-clients-and-proxy-PLAN.md
@.planning/phases/phase-kayinleong-02/02-04-users-cloud-function-and-actions-PLAN.md
@.planning/research/ARCHITECTURE.md
@.planning/research/PITFALLS.md
@firestore.indexes.json
@firestore.rules
@lib/firebase/admin.ts
@lib/firebase/client.ts
@lib/auth/dal.ts
@lib/types/item.ts
@lib/types/transaction.ts
@lib/schemas/item.ts
@lib/schemas/transaction.ts
@lib/mock/store.ts
@lib/hooks/use-mock-store.ts

<interfaces>
```typescript
// lib/data/inventory.server.ts
export type InventoryPage = { items: InventoryItem[]; nextCursor: string | null };
export async function getInventoryPage(opts: {
  cursor?: string | null;
  limit?: number;
  filters?: { category?: string; lifecycleState?: string; isLowStock?: boolean };
}): Promise<InventoryPage>;
export async function getItemServer(itemId: string): Promise<InventoryItem | null>;

// lib/hooks/use-inventory-live.ts
export function useInventoryLive(initial: InventoryItem[], opts?: {
  category?: string;
  lifecycleState?: string;
  isLowStock?: boolean;
  limit?: number;
}): InventoryItem[];

// lib/storage/upload-photo.ts
export async function uploadItemPhoto(itemId: string, file: File): Promise<string>;

// app/(app)/inventory/actions.ts
export async function createItem(input: unknown): Promise<{ ok: true; itemId: string } | { ok: false; errors?: Record<string, string[]>; error?: string }>;
export async function updateItem(itemId: string, input: unknown): Promise<{ ok: true } | { ok: false; error: string }>;
export async function retireItem(itemId: string): Promise<{ ok: true } | { ok: false; error: string }>;
export async function adjustItemStock(input: { itemId: string; delta: number; reason: string }): Promise<{ ok: true } | { ok: false; error: string }>;
export async function updateLowStockThreshold(itemId: string, threshold: number): Promise<{ ok: true } | { ok: false; error: string }>;
export async function markLowStockOrdered(itemId: string): Promise<{ ok: true } | { ok: false; error: string }>;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend InventoryItem type + schema with isLowStock derived field</name>
  <files>
    lib/types/item.ts,
    lib/schemas/item.ts
  </files>
  <read_first>
    - lib/types/item.ts (current Phase 1 type — verify field list: name, sku, totalQty, availableQty, outQty, damagedQty, unit, category, notes, lifecycleState, lowStockThreshold, lowStockOrderedAt, photoUrl, createdAt, updatedAt, createdBy, updatedBy)
    - lib/schemas/item.ts (current Zod schemas)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §"P11 isLowStock denorm drift" lines 1956-1959 + §7.2 lines 1567-1585 (the low-stock query trap)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-21 (KPI count aggregations)
    - .planning/REQUIREMENTS.md RP-01 (lowStockThreshold field), RP-02 (low-stock dashboard widget)
  </read_first>
  <action>
    **Step 1.1 — Add `isLowStock: boolean` to `InventoryItem` type:**

    Open `lib/types/item.ts`. Find the `InventoryItem` type. Add field after `lowStockOrderedAt`:

    ```typescript
    /**
     * Derived field — true iff `lowStockThreshold > 0 && availableQty <= lowStockThreshold`.
     * Maintained by every Server Action that touches availableQty or lowStockThreshold
     * (createItem, updateItem, adjustItemStock, retireItem, updateLowStockThreshold,
     * checkoutItem, checkinItem). Required because Firestore where() cannot compare
     * two fields (RESEARCH §7.2 / P11). Indexed via firestore.indexes.json.
     */
    isLowStock: boolean;
    ```

    **Step 1.2 — Update `lib/schemas/item.ts`** to include `isLowStock` in any schema that produces full InventoryItem (e.g., `ItemSchema` if it exists). For Create/Update schemas which are inputs, do NOT include isLowStock — it's server-derived. Add a helper:

    ```typescript
    // Append to lib/schemas/item.ts:
    export function computeIsLowStock(args: {
      availableQty: number;
      lowStockThreshold: number;
    }): boolean {
      return args.lowStockThreshold > 0 && args.availableQty <= args.lowStockThreshold;
    }
    ```

    This is the SINGLE source of truth for the boolean — all 6+ Server Actions import + call it.

    **Step 1.3 — Verify Phase 1 mock store seed** (`lib/mock/store.ts` + `lib/mock/items.ts`) — if seed items already define isLowStock, fine; otherwise the next plan that consumes the data will see undefined. Since Phase 2 wipes mock data, this is informational only.
  </action>
  <acceptance_criteria>
    - `grep -q "isLowStock: boolean" lib/types/item.ts` succeeds.
    - `grep -q "computeIsLowStock" lib/schemas/item.ts` succeeds.
    - `grep -q "lowStockThreshold > 0 && args.availableQty" lib/schemas/item.ts` succeeds.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "isLowStock: boolean" lib/types/item.ts && grep -q "computeIsLowStock" lib/schemas/item.ts && npx tsc --noEmit</automated>
  </verify>
  <done>Type + helper in place. All subsequent actions import computeIsLowStock.</done>
</task>

<task type="auto">
  <name>Task 2: Admin SDK read helpers + live hook</name>
  <files>
    lib/data/inventory.server.ts,
    lib/hooks/use-inventory-live.ts
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §3.1 lines 845-878 (getInventoryPage pattern)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §7.1 lines 1483-1535 (Server seed + Client onSnapshot pattern)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-17 (cursor pagination), D-20 (listener scope)
    - lib/data/users.server.ts (from 02-04 — mirror cursor-encoding pattern)
    - lib/hooks/use-users-live.ts (from 02-04 — mirror hook shape)
    - lib/types/item.ts (verify isLowStock field exists from Task 1)
  </read_first>
  <action>
    **Step 2.1 — Create `lib/data/inventory.server.ts`:**

    ```typescript
    // lib/data/inventory.server.ts
    // Per RESEARCH §3.1 + D-17 cursor pagination.
    import "server-only";
    import { adminDb } from "@/lib/firebase/admin";
    import type { InventoryItem } from "@/lib/types/item";

    type InvCursor = { name: string; id: string };

    export type InventoryPage = {
      items: InventoryItem[];
      nextCursor: string | null;
    };

    function encodeCursor(c: InvCursor): string {
      return Buffer.from(JSON.stringify(c)).toString("base64");
    }
    function decodeCursor(s: string): InvCursor | null {
      try { return JSON.parse(Buffer.from(s, "base64").toString("utf8")) as InvCursor; }
      catch { return null; }
    }

    function toItem(snap: FirebaseFirestore.QueryDocumentSnapshot): InventoryItem {
      const d = snap.data();
      return {
        id: snap.id,
        sku: snap.id, // SKU = doc ID per PROJECT.md KD #14
        name: d.name,
        totalQty: d.totalQty,
        availableQty: d.availableQty,
        outQty: d.outQty,
        damagedQty: d.damagedQty ?? 0,
        unit: d.unit,
        category: d.category ?? null,
        notes: d.notes ?? null,
        lifecycleState: d.lifecycleState,
        lowStockThreshold: d.lowStockThreshold ?? 0,
        lowStockOrderedAt: d.lowStockOrderedAt?.toMillis?.() ?? null,
        photoUrl: d.photoUrl ?? null,
        isLowStock: d.isLowStock === true,
        createdAt: d.createdAt?.toMillis?.() ?? null,
        updatedAt: d.updatedAt?.toMillis?.() ?? null,
        createdBy: d.createdBy ?? null,
        updatedBy: d.updatedBy ?? null,
      } as InventoryItem;
    }

    export async function getInventoryPage(opts: {
      cursor?: string | null;
      limit?: number;
      filters?: { category?: string; lifecycleState?: string; isLowStock?: boolean };
    }): Promise<InventoryPage> {
      const limit = opts.limit ?? 50;
      let q: FirebaseFirestore.Query = adminDb.collection("inventory");
      if (opts.filters?.category) q = q.where("category", "==", opts.filters.category);
      if (opts.filters?.lifecycleState) q = q.where("lifecycleState", "==", opts.filters.lifecycleState);
      if (opts.filters?.isLowStock === true) q = q.where("isLowStock", "==", true);

      q = q.orderBy("name").orderBy("__name__").limit(limit + 1);

      const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
      if (cursor) q = q.startAfter(cursor.name, cursor.id);

      const snap = await q.get();
      const docs = snap.docs.slice(0, limit);
      const hasMore = snap.docs.length > limit;
      const items = docs.map((d) => toItem(d));
      const last = docs[docs.length - 1];
      const nextCursor = hasMore && last
        ? encodeCursor({ name: last.data().name, id: last.id })
        : null;
      return { items, nextCursor };
    }

    export async function getItemServer(itemId: string): Promise<InventoryItem | null> {
      const snap = await adminDb.collection("inventory").doc(itemId).get();
      if (!snap.exists) return null;
      return toItem(snap as FirebaseFirestore.QueryDocumentSnapshot);
    }
    ```

    **Step 2.2 — Create `lib/hooks/use-inventory-live.ts`** (Web SDK hook, cursor-page scoped per D-20):

    ```typescript
    "use client";
    // lib/hooks/use-inventory-live.ts
    // Per D-20: scoped to 50-row visible window. Tears down on filter change.

    import { useEffect, useState } from "react";
    import {
      collection,
      query,
      where,
      orderBy,
      limit as fbLimit,
      onSnapshot,
      documentId,
      type QuerySnapshot,
      type QueryDocumentSnapshot,
    } from "firebase/firestore";
    import { db } from "@/lib/firebase/client";
    import type { InventoryItem } from "@/lib/types/item";

    function toItem(d: QueryDocumentSnapshot): InventoryItem {
      const data = d.data();
      return {
        id: d.id,
        sku: d.id,
        name: data.name,
        totalQty: data.totalQty,
        availableQty: data.availableQty,
        outQty: data.outQty,
        damagedQty: data.damagedQty ?? 0,
        unit: data.unit,
        category: data.category ?? null,
        notes: data.notes ?? null,
        lifecycleState: data.lifecycleState,
        lowStockThreshold: data.lowStockThreshold ?? 0,
        lowStockOrderedAt: data.lowStockOrderedAt?.toMillis?.() ?? null,
        photoUrl: data.photoUrl ?? null,
        isLowStock: data.isLowStock === true,
        createdAt: data.createdAt?.toMillis?.() ?? null,
        updatedAt: data.updatedAt?.toMillis?.() ?? null,
        createdBy: data.createdBy ?? null,
        updatedBy: data.updatedBy ?? null,
      } as InventoryItem;
    }

    export function useInventoryLive(
      initial: InventoryItem[],
      opts: { category?: string; lifecycleState?: string; isLowStock?: boolean; limit?: number } = {},
    ): InventoryItem[] {
      const [items, setItems] = useState<InventoryItem[]>(initial);

      useEffect(() => {
        const constraints: any[] = [];
        if (opts.category) constraints.push(where("category", "==", opts.category));
        if (opts.lifecycleState) constraints.push(where("lifecycleState", "==", opts.lifecycleState));
        if (opts.isLowStock === true) constraints.push(where("isLowStock", "==", true));
        constraints.push(orderBy("name"), orderBy(documentId()), fbLimit(opts.limit ?? 50));
        const q = query(collection(db, "inventory"), ...constraints);
        const unsub = onSnapshot(q, (snap: QuerySnapshot) => {
          setItems(snap.docs.map((d) => toItem(d as QueryDocumentSnapshot)));
        });
        return () => unsub();
      }, [opts.category, opts.lifecycleState, opts.isLowStock, opts.limit]);

      return items;
    }
    ```
  </action>
  <acceptance_criteria>
    - `head -1 lib/data/inventory.server.ts | grep -q 'import "server-only"'` succeeds.
    - `grep -q "getInventoryPage" lib/data/inventory.server.ts` succeeds; `grep -q "getItemServer" lib/data/inventory.server.ts` succeeds.
    - `grep -q "startAfter" lib/data/inventory.server.ts` succeeds.
    - `grep -q "isLowStock" lib/data/inventory.server.ts` succeeds.
    - `head -3 lib/hooks/use-inventory-live.ts | grep -q '"use client"'` succeeds.
    - `grep -q "fbLimit(opts.limit ?? 50)" lib/hooks/use-inventory-live.ts` succeeds (D-20).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>head -1 lib/data/inventory.server.ts | grep -q 'import "server-only"' && grep -q "startAfter" lib/data/inventory.server.ts && grep -q "fbLimit(opts.limit ?? 50)" lib/hooks/use-inventory-live.ts && npx tsc --noEmit</automated>
  </verify>
  <done>Read layer + live hook ready.</done>
</task>

<task type="auto">
  <name>Task 3: Photo upload helper (browser-image-compression + Storage)</name>
  <files>
    lib/storage/upload-photo.ts,
    package.json
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §3.3 lines 940-1030 (full photo upload pattern)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-11 (file + camera), D-12 (compression), D-13 (storage rules), D-14 (replace-only)
    - storage.rules (from 02-02 — confirm `items/{itemId}/photo.jpg` admin-write)
    - lib/firebase/client.ts (storage export)
  </read_first>
  <action>
    **Step 3.1 — Install `browser-image-compression`:**

    ```bash
    npm i browser-image-compression
    ```

    Verify: `grep -q '"browser-image-compression"' package.json`.

    **Step 3.2 — Create `lib/storage/upload-photo.ts`:**

    ```typescript
    // lib/storage/upload-photo.ts
    // Per D-11..D-15: client-side compress + upload to items/{itemId}/photo.jpg.
    // Storage rules enforce admin-only write + size < 5MB + image/* content type.

    "use client";
    import imageCompression from "browser-image-compression";
    import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
    import { storage } from "@/lib/firebase/client";

    /**
     * Compress (max 1600px / JPEG 0.85 / target 300KB) and upload to
     * items/{itemId}/photo.jpg. Returns the public download URL.
     */
    export async function uploadItemPhoto(itemId: string, file: File): Promise<string> {
      // D-12 compression options. Cap at 300KB / 1600px long edge.
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.85,
      });

      // D-13/D-14 path — replace-only at items/{itemId}/photo.jpg
      const storageRef = ref(storage, `items/${itemId}/photo.jpg`);
      await uploadBytes(storageRef, compressed, { contentType: "image/jpeg" });
      const url = await getDownloadURL(storageRef);
      return url;
    }
    ```
  </action>
  <acceptance_criteria>
    - `grep -q '"browser-image-compression"' package.json` succeeds.
    - `test -f lib/storage/upload-photo.ts` succeeds.
    - `head -3 lib/storage/upload-photo.ts | grep -q '"use client"'` succeeds.
    - `grep -q "items/\${itemId}/photo.jpg" lib/storage/upload-photo.ts` succeeds (D-14 path).
    - `grep -q "maxSizeMB: 0.3" lib/storage/upload-photo.ts` succeeds (D-12).
    - `grep -q "maxWidthOrHeight: 1600" lib/storage/upload-photo.ts` succeeds (D-12).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q '"browser-image-compression"' package.json && grep -q "items/\\\${itemId}/photo.jpg" lib/storage/upload-photo.ts && grep -q "maxSizeMB: 0.3" lib/storage/upload-photo.ts && npx tsc --noEmit</automated>
  </verify>
  <done>Photo upload helper ready for UI form in 02-06.</done>
</task>

<task type="auto">
  <name>Task 4: Server Actions in app/(app)/inventory/actions.ts (6 mutators with isLowStock denorm)</name>
  <files>app/(app)/inventory/actions.ts</files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §3.2 lines 880-933 (createItem with SKU uniqueness), §3.4 lines 1032-1085 (adjustItemStock)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §"P11 isLowStock denorm drift" lines 1956-1959
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §8.5 lines 1681-1691 (revalidatePath matrix for inventory)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-17 (cursor), D-18 (indexes)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §1 row "app/(app)/inventory/actions.ts" + §4 excerpt B (Server Action shape)
    - lib/schemas/item.ts (CreateItemSchema, UpdateItemSchema, AdjustStockSchema, computeIsLowStock helper from Task 1)
    - lib/mock/store.ts lines 333-639 (the 6 mutator signatures we are matching)
    - lib/auth/dal.ts, lib/firebase/admin.ts
    - .planning/REQUIREMENTS.md INV-01..09, INT-01, INT-03, INT-04, AUD-01..04
  </read_first>
  <action>
    Create `app/(app)/inventory/actions.ts`. Each action: requireAdmin → Zod parse → runTransaction → invariant → audit write → `computeIsLowStock` update → revalidatePath.

    ```typescript
    "use server";
    // app/(app)/inventory/actions.ts
    // Per RESEARCH §3.2-§3.4 + RESEARCH P11 (isLowStock denorm) + AUD-01..04.
    // All 6 mutators wrap state-changing logic in adminDb.runTransaction so
    // INT-01 (atomic stock invariant) holds. Every action that touches
    // availableQty or lowStockThreshold recomputes isLowStock atomically.

    import { requireAdmin } from "@/lib/auth/dal";
    import { adminDb } from "@/lib/firebase/admin";
    import { FieldValue } from "firebase-admin/firestore";
    import { revalidatePath } from "next/cache";
    import {
      CreateItemSchema,
      UpdateItemSchema,
      AdjustStockSchema,
      computeIsLowStock,
    } from "@/lib/schemas/item";

    type ActionResult<T = void> =
      | ({ ok: true } & T)
      | { ok: false; error: string; errors?: Record<string, string[]> };

    /** INV-01 + INV-02 — SKU = doc ID; uniqueness via tx.get assert. */
    export async function createItem(input: unknown): Promise<ActionResult<{ itemId: string }>> {
      const session = await requireAdmin();
      const parsed = CreateItemSchema.safeParse(input);
      if (!parsed.success) {
        return { ok: false, error: "Invalid input", errors: parsed.error.flatten().fieldErrors };
      }
      const data = parsed.data;
      const docRef = adminDb.collection("inventory").doc(data.sku);

      try {
        await adminDb.runTransaction(async (tx) => {
          const existing = await tx.get(docRef);
          if (existing.exists) {
            throw new Error("SKU_EXISTS");
          }
          const isLowStock = computeIsLowStock({
            availableQty: data.totalQty,
            lowStockThreshold: data.lowStockThreshold ?? 0,
          });
          tx.set(docRef, {
            id: data.sku,
            sku: data.sku,
            name: data.name,
            totalQty: data.totalQty,
            availableQty: data.totalQty,
            outQty: 0,
            damagedQty: 0,
            unit: data.unit,
            category: data.category ?? null,
            notes: data.notes ?? null,
            lifecycleState: "available",
            lowStockThreshold: data.lowStockThreshold ?? 0,
            lowStockOrderedAt: null,
            photoUrl: data.photoUrl ?? null,
            isLowStock,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: session.uid,
            updatedBy: session.uid,
          });
        });
        revalidatePath("/inventory");
        revalidatePath("/");
        revalidatePath("/reports/stock");
        return { ok: true, itemId: data.sku };
      } catch (err) {
        if ((err as Error).message === "SKU_EXISTS") {
          return { ok: false, error: "SKU already exists", errors: { sku: ["SKU already exists."] } };
        }
        throw err;
      }
    }

    /** INV-03 — edit name, category, notes, unit, photoUrl, lowStockThreshold. */
    export async function updateItem(itemId: string, input: unknown): Promise<ActionResult> {
      const session = await requireAdmin();
      const parsed = UpdateItemSchema.safeParse(input);
      if (!parsed.success) return { ok: false, error: "Invalid input", errors: parsed.error.flatten().fieldErrors };
      const data = parsed.data;
      const itemRef = adminDb.collection("inventory").doc(itemId);

      try {
        await adminDb.runTransaction(async (tx) => {
          const snap = await tx.get(itemRef);
          if (!snap.exists) throw new Error("ITEM_NOT_FOUND");
          const current = snap.data()!;
          const nextThreshold = data.lowStockThreshold ?? current.lowStockThreshold ?? 0;
          // RESEARCH P11: recompute isLowStock when threshold changes
          const isLowStock = computeIsLowStock({
            availableQty: current.availableQty,
            lowStockThreshold: nextThreshold,
          });
          tx.update(itemRef, {
            name: data.name ?? current.name,
            category: data.category ?? current.category,
            notes: data.notes ?? current.notes,
            unit: data.unit ?? current.unit,
            photoUrl: data.photoUrl ?? current.photoUrl,
            lowStockThreshold: nextThreshold,
            isLowStock,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: session.uid,
          });
        });
        revalidatePath("/inventory");
        revalidatePath(`/inventory/${itemId}`);
        revalidatePath("/");
        revalidatePath("/reports/stock");
        revalidatePath("/reports/repurchase");
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }

    /** INV-05 — soft-delete via lifecycleState=retired. */
    export async function retireItem(itemId: string): Promise<ActionResult> {
      const session = await requireAdmin();
      const itemRef = adminDb.collection("inventory").doc(itemId);
      const txRef = adminDb.collection("transactions").doc();

      try {
        await adminDb.runTransaction(async (tx) => {
          const snap = await tx.get(itemRef);
          if (!snap.exists) throw new Error("ITEM_NOT_FOUND");
          const item = snap.data()!;
          if (item.outQty > 0) throw new Error("ITEM_OUT");

          tx.update(itemRef, {
            lifecycleState: "retired",
            isLowStock: false, // retired items don't trigger alerts
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: session.uid,
          });
          // AUD-01: audit row
          tx.set(txRef, {
            type: "retire",
            itemId,
            itemSku: item.sku,
            itemName: item.name,
            eventId: null,
            eventName: null,
            qty: 0,
            actorUid: session.uid,
            actorName: session.displayName,
            actorRoleAtTimeOfAction: session.role,
            at: FieldValue.serverTimestamp(),
            notes: "Item retired",
            parentTxId: null,
            clientTxId: null,
          });
        });
        revalidatePath("/inventory");
        revalidatePath(`/inventory/${itemId}`);
        revalidatePath("/");
        return { ok: true };
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "ITEM_OUT") return { ok: false, error: "Can't retire — items are still out." };
        return { ok: false, error: msg };
      }
    }

    /** INV-04 — adjust totalQty (and matching availableQty) with required reason + audit row. */
    export async function adjustItemStock(input: { itemId: string; delta: number; reason: string }): Promise<ActionResult> {
      const session = await requireAdmin();
      const parsed = AdjustStockSchema.safeParse(input);
      if (!parsed.success) return { ok: false, error: "Invalid input", errors: parsed.error.flatten().fieldErrors };
      const { itemId, delta, reason } = parsed.data;

      const itemRef = adminDb.collection("inventory").doc(itemId);
      const txRef = adminDb.collection("transactions").doc();

      try {
        await adminDb.runTransaction(async (tx) => {
          const snap = await tx.get(itemRef);
          if (!snap.exists) throw new Error("ITEM_NOT_FOUND");
          const item = snap.data()!;
          const newTotal = item.totalQty + delta;
          const newAvailable = item.availableQty + delta;
          if (newTotal < 0 || newAvailable < 0) throw new Error("WOULD_GO_NEGATIVE");

          const isLowStock = computeIsLowStock({
            availableQty: newAvailable,
            lowStockThreshold: item.lowStockThreshold ?? 0,
          });

          tx.update(itemRef, {
            totalQty: newTotal,
            availableQty: newAvailable,
            isLowStock,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: session.uid,
          });

          tx.set(txRef, {
            type: "adjustment",
            itemId,
            itemSku: item.sku,
            itemName: item.name,
            eventId: null,
            eventName: null,
            qty: Math.abs(delta),
            actorUid: session.uid,
            actorName: session.displayName,
            actorRoleAtTimeOfAction: session.role,
            at: FieldValue.serverTimestamp(),
            notes: reason,
            parentTxId: null,
            clientTxId: null,
          });
        });
        revalidatePath(`/inventory/${itemId}`);
        revalidatePath("/inventory");
        revalidatePath("/");
        revalidatePath("/reports/stock");
        return { ok: true };
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "WOULD_GO_NEGATIVE") return { ok: false, error: "Adjustment would create negative stock." };
        return { ok: false, error: msg };
      }
    }

    /** RP-01 — update lowStockThreshold; recompute isLowStock. */
    export async function updateLowStockThreshold(itemId: string, threshold: number): Promise<ActionResult> {
      const session = await requireAdmin();
      if (typeof threshold !== "number" || threshold < 0 || !Number.isFinite(threshold)) {
        return { ok: false, error: "Threshold must be a non-negative number." };
      }
      const itemRef = adminDb.collection("inventory").doc(itemId);
      try {
        await adminDb.runTransaction(async (tx) => {
          const snap = await tx.get(itemRef);
          if (!snap.exists) throw new Error("ITEM_NOT_FOUND");
          const item = snap.data()!;
          const isLowStock = computeIsLowStock({
            availableQty: item.availableQty,
            lowStockThreshold: threshold,
          });
          tx.update(itemRef, {
            lowStockThreshold: threshold,
            lowStockOrderedAt: null, // reset ordered flag on threshold change
            isLowStock,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: session.uid,
          });
        });
        revalidatePath("/inventory");
        revalidatePath(`/inventory/${itemId}`);
        revalidatePath("/reports/repurchase");
        revalidatePath("/");
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }

    /** RP-04 — mark low-stock as ordered (UI surface; no qty change). */
    export async function markLowStockOrdered(itemId: string): Promise<ActionResult> {
      const session = await requireAdmin();
      const itemRef = adminDb.collection("inventory").doc(itemId);
      try {
        await itemRef.update({
          lowStockOrderedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: session.uid,
        });
        revalidatePath("/reports/repurchase");
        revalidatePath("/");
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }
    ```

    NOTE on schemas: if `CreateItemSchema`, `UpdateItemSchema`, `AdjustStockSchema` don't exist in `lib/schemas/item.ts`, add them based on the Phase 1 mock store mutator signatures (lines 333-389 of store.ts). They likely DO exist from Phase 1 — verify with grep first.
  </action>
  <acceptance_criteria>
    - `head -1 "app/(app)/inventory/actions.ts" | grep -q '"use server"'` succeeds.
    - All 6 actions defined: `grep -cE "^export async function (createItem|updateItem|retireItem|adjustItemStock|updateLowStockThreshold|markLowStockOrdered)" "app/(app)/inventory/actions.ts"` returns 6.
    - All actions call `requireAdmin`: count = 6: `grep -c "await requireAdmin()" "app/(app)/inventory/actions.ts"` returns 6.
    - All 5 mutators that change availableQty or lowStockThreshold call `computeIsLowStock`: `grep -c "computeIsLowStock" "app/(app)/inventory/actions.ts"` returns at least 4 (createItem, updateItem, adjustItemStock, updateLowStockThreshold; retireItem hardcodes isLowStock: false, markLowStockOrdered doesn't touch qty).
    - `grep -q "runTransaction" "app/(app)/inventory/actions.ts"` succeeds (INT-01).
    - Count of `runTransaction`: `grep -c "adminDb.runTransaction" "app/(app)/inventory/actions.ts"` returns at least 5 (all except markLowStockOrdered).
    - `grep -q "transactions.*type: \"adjustment\"" "app/(app)/inventory/actions.ts"` OR similar — verify audit writes exist: `grep -c "tx.set(txRef" "app/(app)/inventory/actions.ts"` returns at least 2 (retire + adjust).
    - `grep -q "SKU_EXISTS" "app/(app)/inventory/actions.ts"` succeeds (INV-02 unique check).
    - `grep -q "WOULD_GO_NEGATIVE" "app/(app)/inventory/actions.ts"` succeeds (INT-01 invariant).
    - `grep -q "ITEM_OUT" "app/(app)/inventory/actions.ts"` succeeds (retire safety).
    - `grep -q "revalidatePath" "app/(app)/inventory/actions.ts"` succeeds at least 6 times: `grep -c "revalidatePath" "app/(app)/inventory/actions.ts"` >= 12 (multiple paths per action).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>head -1 "app/(app)/inventory/actions.ts" | grep -q '"use server"' && [ "$(grep -cE '^export async function (createItem|updateItem|retireItem|adjustItemStock|updateLowStockThreshold|markLowStockOrdered)' 'app/(app)/inventory/actions.ts')" = "6" ] && [ "$(grep -c 'await requireAdmin()' 'app/(app)/inventory/actions.ts')" = "6" ] && grep -q "computeIsLowStock" "app/(app)/inventory/actions.ts" && grep -q "SKU_EXISTS" "app/(app)/inventory/actions.ts" && grep -q "WOULD_GO_NEGATIVE" "app/(app)/inventory/actions.ts" && npx tsc --noEmit</automated>
  </verify>
  <done>6 inventory Server Actions live. Every stock-changing tx atomically updates isLowStock per P11. UI wiring in 02-06.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Server Action input | Untrusted; Zod-validated; admin-only |
| Admin SDK → Firestore | Bypasses rules; relies on requireAdmin + tx invariant |
| Client SDK upload to Storage | Subject to storage.rules (admin-only write per D-13) |
| Browser file picker → upload-photo.ts | Untrusted file; compressed + JPEG-coerced before upload |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-05-01 | Tampering | Client manipulates availableQty via direct write | mitigate | firestore.rules inventory invariant (02-02); all mutations server-side via Admin SDK after requireAdmin |
| T-02-05-02 | Tampering | SKU collision via race | mitigate | tx.get(docRef) + exists assertion inside runTransaction; Firestore serializes |
| T-02-05-03 | Tampering | isLowStock drift between collection and counter | mitigate | All 5+ Server Actions recompute isLowStock atomically inside the same runTransaction (RESEARCH P11) |
| T-02-05-04 | Tampering | Negative stock via concurrent adjustItemStock | mitigate | runTransaction read + invariant assert + write; retries on conflict |
| T-02-05-05 | Repudiation | Stock adjustment not logged | mitigate | Every adjustItemStock writes a transactions doc with type='adjustment' + actor snapshot + reason (AUD-01) |
| T-02-05-06 | Information disclosure | Photo URL leaks via getDownloadURL | accept | Storage rules require auth on read; download URLs are signed by Firebase but require auth to enumerate; bucket-level rules in 02-02 deny anonymous |
| T-02-05-07 | DoS | Image upload 12MB iPhone | mitigate | browser-image-compression caps at 0.3MB / 1600px; Storage rules reject > 5MB |
| T-02-05-08 | Elevation of privilege | Staff invokes createItem via direct fetch | mitigate | requireAdmin() at top of every action; redirects to /unauthorized |
| T-02-05-09 | Tampering | Retire item while out → causes stuck-out items (PITFALLS C5) | mitigate | retireItem checks outQty > 0 → returns ITEM_OUT error; admin must check-in first |
| T-02-05-10 | Information disclosure | Audit log readable by all signed-in users | accept | Per firestore.rules transactions allow read: if isSignedIn(); audit trail is org-internal |
</threat_model>

<verification>
- `lib/types/item.ts` declares `isLowStock: boolean`.
- `lib/schemas/item.ts` exports `computeIsLowStock`.
- `lib/data/inventory.server.ts` cursor-paged Admin SDK helper, server-only.
- `lib/hooks/use-inventory-live.ts` 50-row onSnapshot hook.
- `lib/storage/upload-photo.ts` compress + upload at fixed path.
- `app/(app)/inventory/actions.ts` 6 actions; all gated by requireAdmin; 5 wrap state changes in runTransaction; all update isLowStock atomically (except markLowStockOrdered which doesn't touch qty); 2 write audit rows (retire + adjust).
- `npm run build` exits 0.
- `npx tsc --noEmit` exits 0.
- `npm run lint` exits 0.
</verification>

<success_criteria>
- INV-01..10 partially satisfied (all action behavior wired; UI swap in 02-06 finalizes INV-06..08).
- INT-01 (atomic stock invariant), INT-03 (no client writes to transactions), INT-04 (DAL gate on all actions) satisfied.
- AUD-01..04 (audit row per state-changing action — full coverage in 02-08/02-09 for checkout/checkin).
- RP-01 (lowStockThreshold field) and RP-02 (low-stock query via isLowStock denorm) wired at data layer.
- P11 denormalization handled across every Server Action.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-05-inventory-data-layer-and-actions-SUMMARY.md` listing:
- 7 files modified/created.
- All 6 Server Action signatures + their error codes (SKU_EXISTS, WOULD_GO_NEGATIVE, ITEM_OUT, ITEM_NOT_FOUND).
- Per-action revalidatePath list.
- isLowStock denorm callsites confirmed across the 5 stock-changing actions.
- Audit-row signatures (retire + adjust write to transactions in this plan; checkout/checkin will follow same pattern in 02-08/02-09).
The summary should be ≤ 100 lines.
</output>
