---
phase: phase-kayinleong-02
plan: 06
type: execute
wave: 6
depends_on:
  - 05
files_modified:
  - app/(app)/inventory/page.tsx
  - app/(app)/inventory/new/page.tsx
  - app/(app)/inventory/[itemId]/page.tsx
  - app/(app)/inventory/[itemId]/edit/page.tsx
  - components/feature/inventory/InventoryTable.tsx
  - components/feature/inventory/ItemForm.tsx
  - components/feature/inventory/ItemPhotoField.tsx
  - components/feature/inventory/RetireItemButton.tsx
  - components/feature/inventory/ItemHistoryTab.tsx
  - components/feature/inventory/AdjustStockDialog.tsx
  - components/feature/settings/LowStockThresholdsCard.tsx
  - lib/hooks/use-url-table-state.ts
  - lib/hooks/use-transactions-live.ts
autonomous: false
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
  - INV-10
  - INT-01
  - INT-02
  - INT-03
  - AUD-01
  - AUD-02
  - AUD-04
  - REP-06

must_haves:
  truths:
    - "/inventory page renders Server-Component-seeded list, then Client onSnapshot takes over per D-20."
    - "/inventory uses cursor pagination per D-17 — `?cursor=xxx` URL contract, no total-count UI."
    - "InventoryTable consumes useInventoryLive(initial); TanStack manualPagination: true."
    - "ItemForm uses createItem/updateItem Server Actions; surfaces SKU_EXISTS via setError('sku', ...)."
    - "/inventory/new and /inventory/[itemId]/edit have a photo field per D-15 — reuses ScannerWidget camera substrate per D-11."
    - "Item-detail audit feed reads from transactions collection (real data, not mock) per AUD-02."
    - "RetireItemButton uses retireItem Server Action; surfaces ITEM_OUT error."
    - "QR label print stays client-side bwip-js (Phase 1 unchanged) per CONTEXT.md `<specifics>`."
    - "lib/hooks/use-url-table-state.ts setCursor replaces setPage; filter changes clear cursor (RESEARCH P9)."
    - "lib/hooks/use-transactions-live.ts ships hook for item-detail + event-detail audit feeds."
    - "Manual rules audit covers inventory + storage collections per D-06."
  artifacts:
    - path: "components/feature/inventory/ItemPhotoField.tsx"
      provides: "File upload + Take photo button reusing ScannerWidget camera; calls uploadItemPhoto"
      contains: "uploadItemPhoto"
    - path: "lib/hooks/use-transactions-live.ts"
      provides: "Reactive hook for transactions audit feed scoped by itemId / eventId / cursor"
      contains: "onSnapshot"
    - path: "lib/hooks/use-url-table-state.ts"
      provides: "Modified to use cursor URL contract per D-17 + RESEARCH P9 (clear cursor on filter change)"
      contains: "setCursor"
    - path: "components/feature/inventory/InventoryTable.tsx"
      provides: "Cursor pagination + live data via useInventoryLive"
      contains: "manualPagination: true"
  key_links:
    - from: "components/feature/inventory/ItemForm.tsx"
      to: "lib/storage/upload-photo.ts"
      via: "Photo field invokes uploadItemPhoto(sku, file) before submitting form"
      pattern: "uploadItemPhoto"
    - from: "components/feature/inventory/ItemHistoryTab.tsx"
      to: "lib/hooks/use-transactions-live.ts"
      via: "useTransactionsLive({itemId, orderBy: 'at desc'})"
      pattern: "useTransactionsLive"
    - from: "lib/hooks/use-url-table-state.ts setFilter"
      to: "URL query params"
      via: "Filter change clears ?cursor= per RESEARCH P9"
      pattern: "delete.*cursor"
---

<objective>
**Block C — Inventory UI swap.** Wire the inventory list/detail/new/edit pages from mock store to Firestore via the 02-05 helpers + actions. Implement the D-15 photo field on both forms. Migrate `useUrlTableState` from `?page=N` to `?cursor=xxx` (D-17). Wire the audit feed on item-detail to read real transactions. Finish with a manual rules audit for inventory + storage.

UI surface from Phase 1 is preserved except for the explicit amendments: photo field (D-15) and cursor URLs (D-17).
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
@.planning/phases/phase-kayinleong-02/02-05-inventory-data-layer-and-actions-PLAN.md
@.planning/phases/phase-kayinleong-01/01-06-inventory-SUMMARY.md
@.planning/phases/phase-kayinleong-01/01-UI-SPEC.md
@firestore.rules
@storage.rules
@app/(app)/inventory/page.tsx
@app/(app)/inventory/new/page.tsx
@app/(app)/inventory/[itemId]/page.tsx
@app/(app)/inventory/[itemId]/edit/page.tsx
@components/feature/inventory/InventoryTable.tsx
@components/feature/inventory/ItemForm.tsx
@components/feature/inventory/RetireItemButton.tsx
@components/feature/inventory/ItemHistoryTab.tsx
@components/feature/inventory/AdjustStockDialog.tsx
@components/feature/settings/LowStockThresholdsCard.tsx
@components/feature/scan/ScannerWidget.tsx
@lib/hooks/use-url-table-state.ts
@lib/hooks/use-mock-store.ts
@lib/data/inventory.server.ts
@lib/hooks/use-inventory-live.ts
@lib/storage/upload-photo.ts
@app/(app)/inventory/actions.ts
@lib/auth/dal.ts

<interfaces>
```typescript
// lib/hooks/use-url-table-state.ts — UPDATED for D-17
export type UrlTableState = {
  cursor: string | null;
  q: string;
  sort: string;
  filters: Record<string, string>;
};
export function useUrlTableState(): {
  state: UrlTableState;
  setCursor: (cursor: string | null) => void;
  setGlobalFilter: (q: string) => void;
  setSort: (s: string) => void;
  setFilter: (key: string, val: string | null) => void;
};

// lib/hooks/use-transactions-live.ts (NEW)
export function useTransactionsLive(opts: {
  itemId?: string;
  eventId?: string;
  actorUid?: string;
  type?: string;
  limit?: number;
}): TransactionDoc[];
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate useUrlTableState to cursor URL contract</name>
  <files>lib/hooks/use-url-table-state.ts</files>
  <read_first>
    - lib/hooks/use-url-table-state.ts (current Phase 1 implementation: ?page=N grammar)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §7.1 lines 1466-1479 (Hook signature update for D-17)
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §"P9: Cursor invalidation on filter change" lines 1947-1949
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-17 (cursor URL contract), REP-06 (shareable URLs)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §1 row "lib/hooks/use-url-table-state.ts (modify)" + §5 "Cursor URL contract"
  </read_first>
  <action>
    Open `lib/hooks/use-url-table-state.ts`. The Phase 1 implementation uses `?page=N` + `useSearchParams + router.replace`. Migrate to cursor grammar.

    Rewrite the public API:

    ```typescript
    "use client";
    // lib/hooks/use-url-table-state.ts
    // Per D-17: cursor URL contract. ?page=N replaced with ?cursor=xxx (opaque).
    // Per RESEARCH P9: filter / sort / q changes MUST clear cursor.
    // Per REP-06: filter/sort/search URL params shareable.

    import { useCallback, useMemo, useTransition } from "react";
    import { useRouter, usePathname, useSearchParams } from "next/navigation";

    export type UrlTableState = {
      cursor: string | null;
      q: string;
      sort: string;
      filters: Record<string, string>;
    };

    export function useUrlTableState(filterKeys: string[] = []): {
      state: UrlTableState;
      pending: boolean;
      setCursor: (cursor: string | null) => void;
      setGlobalFilter: (q: string) => void;
      setSort: (sort: string) => void;
      setFilter: (key: string, val: string | null) => void;
    } {
      const router = useRouter();
      const pathname = usePathname();
      const params = useSearchParams();
      const [pending, startTransition] = useTransition();

      const state: UrlTableState = useMemo(() => {
        const filters: Record<string, string> = {};
        for (const key of filterKeys) {
          const v = params.get(key);
          if (v) filters[key] = v;
        }
        return {
          cursor: params.get("cursor"),
          q: params.get("q") ?? "",
          sort: params.get("sort") ?? "",
          filters,
        };
      }, [params, filterKeys]);

      const push = useCallback((next: URLSearchParams) => {
        startTransition(() => {
          router.replace(`${pathname}?${next.toString()}`, { scroll: false });
        });
      }, [router, pathname]);

      const setCursor = useCallback((cursor: string | null) => {
        const next = new URLSearchParams(params);
        if (cursor === null) next.delete("cursor"); else next.set("cursor", cursor);
        push(next);
      }, [params, push]);

      const setGlobalFilter = useCallback((q: string) => {
        const next = new URLSearchParams(params);
        // P9: clear cursor on filter change
        next.delete("cursor");
        if (q) next.set("q", q); else next.delete("q");
        push(next);
      }, [params, push]);

      const setSort = useCallback((sort: string) => {
        const next = new URLSearchParams(params);
        next.delete("cursor"); // P9
        if (sort) next.set("sort", sort); else next.delete("sort");
        push(next);
      }, [params, push]);

      const setFilter = useCallback((key: string, val: string | null) => {
        const next = new URLSearchParams(params);
        next.delete("cursor"); // P9
        if (val === null || val === "") next.delete(key); else next.set(key, val);
        push(next);
      }, [params, push]);

      return { state, pending, setCursor, setGlobalFilter, setSort, setFilter };
    }
    ```

    **CRITICAL — `setPage` is GONE.** Any Phase 1 component that called `setPage` must be migrated to `setCursor` in subsequent tasks. The hook does not export `setPage` anymore.
  </action>
  <acceptance_criteria>
    - `grep -q "setCursor" lib/hooks/use-url-table-state.ts` succeeds.
    - `grep -q "setPage" lib/hooks/use-url-table-state.ts` FAILS (removed).
    - `grep -q "params.get(\"cursor\")" lib/hooks/use-url-table-state.ts` succeeds.
    - `grep -q "delete(\"cursor\")" lib/hooks/use-url-table-state.ts` succeeds in setGlobalFilter, setSort, setFilter (P9 mitigation).
    - Count of `next.delete("cursor")` in the file: `grep -c 'next.delete("cursor")' lib/hooks/use-url-table-state.ts` >= 3.
    - `npx tsc --noEmit` will fail until consumers swap setPage→setCursor — that's Task 4. Just verify the file itself compiles in isolation.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "setCursor" lib/hooks/use-url-table-state.ts && ! grep -q "setPage" lib/hooks/use-url-table-state.ts && [ "$(grep -c 'next.delete(\"cursor\")' lib/hooks/use-url-table-state.ts)" -ge "3" ]</automated>
  </verify>
  <done>useUrlTableState exposes cursor URL contract. Consumers updated in Tasks 3+.</done>
</task>

<task type="auto">
  <name>Task 2: useTransactionsLive hook + Photo field component</name>
  <files>
    lib/hooks/use-transactions-live.ts,
    components/feature/inventory/ItemPhotoField.tsx
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §3.3 lines 940-1030 (Photo field with camera reuse pattern)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-11 (photo source + camera reuse), D-14 (replace-only), D-15 (UI surface amendment)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §1 row "components/feature/inventory/ItemForm.tsx" (D-15 + camera substrate detail) + row "ItemHistoryTab.tsx"
    - components/feature/scan/ScannerWidget.tsx (camera permission + iOS pattern to reuse)
    - lib/storage/upload-photo.ts (from 02-05 — uploadItemPhoto)
    - lib/firebase/client.ts (db, storage)
    - lib/types/transaction.ts (TransactionDoc type)
    - .planning/phases/phase-kayinleong-02/02-CONTEXT.md D-20 (listener scope)
  </read_first>
  <action>
    **Step 2.1 — Create `lib/hooks/use-transactions-live.ts`** (for item-detail + event-detail audit feeds):

    ```typescript
    "use client";
    // lib/hooks/use-transactions-live.ts
    // Live audit feed hook. Scoped by itemId / eventId / actorUid / type.
    // Uses firestore.indexes.json composite indexes per D-18:
    //   transactions(itemId, at desc), transactions(eventId, at desc), etc.

    import { useEffect, useState } from "react";
    import {
      collection, query, where, orderBy, limit as fbLimit, onSnapshot,
      type QueryDocumentSnapshot,
    } from "firebase/firestore";
    import { db } from "@/lib/firebase/client";
    import type { TransactionDoc } from "@/lib/types/transaction";

    function toTx(d: QueryDocumentSnapshot): TransactionDoc {
      const data = d.data();
      return {
        id: d.id,
        type: data.type,
        itemId: data.itemId,
        itemSku: data.itemSku,
        itemName: data.itemName,
        eventId: data.eventId ?? null,
        eventName: data.eventName ?? null,
        qty: data.qty,
        actorUid: data.actorUid,
        actorName: data.actorName,
        actorRoleAtTimeOfAction: data.actorRoleAtTimeOfAction,
        at: data.at?.toMillis?.() ?? 0,
        notes: data.notes ?? "",
        parentTxId: data.parentTxId ?? null,
        clientTxId: data.clientTxId ?? null,
      } as TransactionDoc;
    }

    export function useTransactionsLive(
      opts: { itemId?: string; eventId?: string; actorUid?: string; type?: string; limit?: number; initial?: TransactionDoc[] } = {},
    ): TransactionDoc[] {
      const [txs, setTxs] = useState<TransactionDoc[]>(opts.initial ?? []);

      useEffect(() => {
        const constraints: any[] = [];
        if (opts.itemId) constraints.push(where("itemId", "==", opts.itemId));
        if (opts.eventId) constraints.push(where("eventId", "==", opts.eventId));
        if (opts.actorUid) constraints.push(where("actorUid", "==", opts.actorUid));
        if (opts.type) constraints.push(where("type", "==", opts.type));
        constraints.push(orderBy("at", "desc"), fbLimit(opts.limit ?? 50));

        const q = query(collection(db, "transactions"), ...constraints);
        const unsub = onSnapshot(q, (snap) => {
          setTxs(snap.docs.map((d) => toTx(d as QueryDocumentSnapshot)));
        });
        return () => unsub();
      }, [opts.itemId, opts.eventId, opts.actorUid, opts.type, opts.limit]);

      return txs;
    }
    ```

    **Step 2.2 — Create `components/feature/inventory/ItemPhotoField.tsx`** per RESEARCH §3.3 + D-11/D-15.

    Reuse the ScannerWidget camera-permission pattern. Two upload paths: file picker + Take photo (inline getUserMedia).

    ```typescript
    "use client";
    // components/feature/inventory/ItemPhotoField.tsx
    // Per D-11 (file + camera), D-12 (compression in upload-photo helper), D-13/D-14 (storage path).
    // Reuses ScannerWidget camera permission + iOS error pattern.

    import { useRef, useState } from "react";
    import { Camera, ImagePlus, Loader2 } from "lucide-react";
    import { toast } from "sonner";
    import { uploadItemPhoto } from "@/lib/storage/upload-photo";
    import { Button } from "@/components/ui/button";

    export function ItemPhotoField({
      itemId,
      initialUrl,
      onChange,
    }: {
      itemId: string;
      initialUrl: string | null;
      onChange: (url: string | null) => void;
    }) {
      const fileInputRef = useRef<HTMLInputElement>(null);
      const videoRef = useRef<HTMLVideoElement>(null);
      const [showCamera, setShowCamera] = useState(false);
      const [uploading, setUploading] = useState(false);
      const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);

      async function processAndUpload(file: File) {
        setUploading(true);
        try {
          const url = await uploadItemPhoto(itemId, file);
          setPreviewUrl(url);
          onChange(url);
          toast.success("Photo uploaded");
        } catch (err) {
          // Storage rules error or compression error
          const msg = err instanceof Error ? err.message : "Upload failed";
          toast.error(`Couldn't upload photo: ${msg}`);
        } finally {
          setUploading(false);
        }
      }

      async function captureFromCamera() {
        try {
          // Reuse ScannerWidget pattern: facingMode environment for rear camera
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
          });
          setShowCamera(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
        } catch (err) {
          // iOS-specific copy from ScannerWidget pattern
          const msg = err instanceof Error ? err.message : "Camera unavailable";
          toast.error(`Camera access denied. ${msg}`);
        }
      }

      async function snapPhoto() {
        if (!videoRef.current) return;
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, "image/jpeg", 0.9),
        );
        if (!blob) return;
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        // Stop stream
        const stream = videoRef.current.srcObject as MediaStream | null;
        stream?.getTracks().forEach((t) => t.stop());
        setShowCamera(false);
        await processAndUpload(file);
      }

      function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) void processAndUpload(file);
      }

      return (
        <div className="space-y-3">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="w-32 h-32 rounded-md object-cover border" />
          ) : (
            <div className="w-32 h-32 rounded-md border bg-muted flex items-center justify-center">
              <span className="text-xs text-muted-foreground">No photo</span>
            </div>
          )}

          {showCamera ? (
            <div className="space-y-2">
              <video ref={videoRef} className="w-full rounded-md border" playsInline muted />
              <div className="flex gap-2">
                <Button type="button" onClick={snapPhoto}>Snap</Button>
                <Button type="button" variant="outline" onClick={() => setShowCamera(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFilePick}
                className="hidden"
              />
              <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                Choose file
              </Button>
              <Button type="button" variant="outline" disabled={uploading} onClick={captureFromCamera}>
                <Camera className="size-4" />
                Take photo
              </Button>
            </div>
          )}
        </div>
      );
    }
    ```

    NOTE: This uses inline `<img>`. Phase 1 may have used `next/image` elsewhere — for Storage download URLs, `next/image` requires the bucket to be added to `next.config.ts` `images.remotePatterns`. Using plain `<img>` avoids that config. If Phase 1 strictly used next/image, prefer this simpler approach for now.
  </action>
  <acceptance_criteria>
    - `test -f lib/hooks/use-transactions-live.ts` succeeds.
    - `head -3 lib/hooks/use-transactions-live.ts | grep -q '"use client"'` succeeds.
    - `grep -q "onSnapshot" lib/hooks/use-transactions-live.ts` succeeds.
    - `grep -q 'orderBy("at", "desc")' lib/hooks/use-transactions-live.ts` succeeds.
    - `test -f components/feature/inventory/ItemPhotoField.tsx` succeeds.
    - `grep -q "uploadItemPhoto" components/feature/inventory/ItemPhotoField.tsx` succeeds.
    - `grep -q "facingMode.*environment" components/feature/inventory/ItemPhotoField.tsx` succeeds (rear camera per Phase 1 pattern).
    - `grep -q "getUserMedia" components/feature/inventory/ItemPhotoField.tsx` succeeds.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "onSnapshot" lib/hooks/use-transactions-live.ts && grep -q "uploadItemPhoto" components/feature/inventory/ItemPhotoField.tsx && grep -q "facingMode.*environment" components/feature/inventory/ItemPhotoField.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>Audit feed hook + photo field component ready.</done>
</task>

<task type="auto">
  <name>Task 3: Server Component pages — inventory list, new, detail, edit</name>
  <files>
    app/(app)/inventory/page.tsx,
    app/(app)/inventory/new/page.tsx,
    app/(app)/inventory/[itemId]/page.tsx,
    app/(app)/inventory/[itemId]/edit/page.tsx
  </files>
  <read_first>
    - Each Phase 1 page file (verify current imports + JSX structure)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §1 rows for each page + §3 import-rewrite list
    - .planning/phases/phase-kayinleong-02/02-RESEARCH.md §7.1 lines 1483-1505 (Server Component reads cursor pattern)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §4 excerpt C (SSR seed pattern)
    - lib/data/inventory.server.ts (from 02-05)
    - lib/auth/dal.ts
  </read_first>
  <action>
    Pattern is identical across all 4 pages: replace mock imports with real DAL + getItemServer/getInventoryPage.

    **Step 3.1 — `app/(app)/inventory/page.tsx`:**

    ```typescript
    // app/(app)/inventory/page.tsx — Server Component
    import { requireSession } from "@/lib/auth/dal";
    import { getInventoryPage } from "@/lib/data/inventory.server";
    import { InventoryTable } from "@/components/feature/inventory/InventoryTable";
    // ... preserve all Phase 1 layout/chrome imports (PageHeader, Button, etc.) ...

    type RouteProps = {
      searchParams: Promise<{
        cursor?: string;
        category?: string;
        lifecycleState?: string;
        isLowStock?: string;
        q?: string;
      }>;
    };

    export default async function InventoryPage({ searchParams }: RouteProps) {
      const session = await requireSession();
      const params = await searchParams;
      const { items, nextCursor } = await getInventoryPage({
        cursor: params.cursor ?? null,
        filters: {
          category: params.category,
          lifecycleState: params.lifecycleState,
          isLowStock: params.isLowStock === "true" ? true : undefined,
        },
      });
      return (
        <>
          {/* PRESERVE Phase 1 PageHeader + "Create item" button (admin-only) chrome */}
          <InventoryTable
            initialItems={items}
            nextCursor={nextCursor}
            isAdmin={session.role === "admin"}
          />
        </>
      );
    }
    ```

    **Step 3.2 — `app/(app)/inventory/new/page.tsx`:**

    Single-line import swap (PATTERNS row): `import { requireAdmin } from "@/lib/auth/dal"`. Everything else preserved. The page renders `<ItemForm/>`; the form's photo field is wired in Task 4.

    **Step 3.3 — `app/(app)/inventory/[itemId]/page.tsx`:**

    ```typescript
    // app/(app)/inventory/[itemId]/page.tsx — Server Component
    import { notFound } from "next/navigation";
    import { verifySession } from "@/lib/auth/dal";
    import { getItemServer } from "@/lib/data/inventory.server";
    import { ItemDetail } from "@/components/feature/inventory/ItemDetail";

    type RouteProps = { params: Promise<{ itemId: string }> };

    export default async function ItemDetailPage({ params }: RouteProps) {
      const session = await verifySession();
      const { itemId } = await params;
      const item = await getItemServer(itemId);
      if (!item) notFound();
      const isAdmin = session?.role === "admin";
      return <ItemDetail initial={item} isAdmin={isAdmin} />;
    }
    ```

    NOTE: `<ItemDetail/>` is a Phase 1 component; it consumes `item` prop. Phase 2 swap is: ItemDetail's internal `useMockStore` for its history tab → `useTransactionsLive({itemId})` (handled in Task 4).

    **Step 3.4 — `app/(app)/inventory/[itemId]/edit/page.tsx`:**

    ```typescript
    import { notFound } from "next/navigation";
    import { requireAdmin } from "@/lib/auth/dal";
    import { getItemServer } from "@/lib/data/inventory.server";
    import { ItemForm } from "@/components/feature/inventory/ItemForm";

    type RouteProps = { params: Promise<{ itemId: string }> };

    export default async function EditItemPage({ params }: RouteProps) {
      await requireAdmin();
      const { itemId } = await params;
      const item = await getItemServer(itemId);
      if (!item) notFound();
      return <ItemForm initial={item} mode="edit" />;
    }
    ```
  </action>
  <acceptance_criteria>
    - `grep -q "getInventoryPage" "app/(app)/inventory/page.tsx"` succeeds.
    - `grep -q "from \"@/lib/auth/dal\"" "app/(app)/inventory/page.tsx"` succeeds.
    - `grep -q "useMockStore" "app/(app)/inventory/page.tsx"` FAILS.
    - `grep -q "getItemServer" "app/(app)/inventory/[itemId]/page.tsx"` succeeds.
    - `grep -q "from \"@/lib/auth/dal\"" "app/(app)/inventory/[itemId]/edit/page.tsx"` succeeds.
    - `grep -q "from \"@/lib/auth/dal\"" "app/(app)/inventory/new/page.tsx"` succeeds.
    - `grep -q "from \"@/lib/auth/mock-session\"" "app/(app)/inventory/page.tsx"` FAILS (mock-session is now a re-export shim, but we want the direct DAL import for cleanliness).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "getInventoryPage" "app/(app)/inventory/page.tsx" && grep -q "getItemServer" "app/(app)/inventory/[itemId]/page.tsx" && grep -q "from \"@/lib/auth/dal\"" "app/(app)/inventory/[itemId]/edit/page.tsx" && npx tsc --noEmit</automated>
  </verify>
  <done>4 Server Components swapped. Server-Component-seed → Client-takes-over pattern in place.</done>
</task>

<task type="auto">
  <name>Task 4: Client components — InventoryTable + ItemForm + Retire + History + AdjustStock + LowStockThresholdsCard</name>
  <files>
    components/feature/inventory/InventoryTable.tsx,
    components/feature/inventory/ItemForm.tsx,
    components/feature/inventory/RetireItemButton.tsx,
    components/feature/inventory/ItemHistoryTab.tsx,
    components/feature/inventory/AdjustStockDialog.tsx,
    components/feature/settings/LowStockThresholdsCard.tsx
  </files>
  <read_first>
    - Each Phase 1 component file (verify current mock-store imports + actor-lookup pattern)
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §1 rows for each + §3 import-rewrite list
    - .planning/phases/phase-kayinleong-02/02-PATTERNS.md §3 "lib/mock/users.ts" — note all seedUsers.find(...) actor lookups MUST be deleted
    - lib/hooks/use-inventory-live.ts, lib/hooks/use-transactions-live.ts (from 02-05/Task 2)
    - lib/hooks/use-url-table-state.ts (after Task 1 swap)
    - app/(app)/inventory/actions.ts (from 02-05)
    - components/feature/inventory/ItemPhotoField.tsx (Task 2)
  </read_first>
  <action>
    Pattern across all 6: swap mock-store → live hook + Server Action, delete seedUsers actor lookups, surface results via sonner toast + rhf setError.

    **Step 4.1 — `components/feature/inventory/InventoryTable.tsx`:**

    Phase 1 props/columns preserved. The swap:

    ```typescript
    "use client";
    import { useInventoryLive } from "@/lib/hooks/use-inventory-live";
    import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
    import { useRouter, usePathname } from "next/navigation";
    // ... TanStack imports preserved from Phase 1 ...
    import type { InventoryItem } from "@/lib/types/item";

    export function InventoryTable({
      initialItems,
      nextCursor,
      isAdmin,
    }: {
      initialItems: InventoryItem[];
      nextCursor: string | null;
      isAdmin: boolean;
    }) {
      // D-20: page-scoped live data
      const items = useInventoryLive(initialItems);
      const { state, setGlobalFilter, setFilter, setCursor } = useUrlTableState([
        "category",
        "lifecycleState",
        "isLowStock",
      ]);
      const router = useRouter();
      const pathname = usePathname();

      // ... preserve Phase 1 column defs, sort logic, search input ...

      const table = useReactTable({
        data: items,
        columns,
        manualPagination: true,    // D-17
        pageCount: -1,             // unknown (Firestore can't tell us)
        state: { pagination: { pageIndex: 0, pageSize: 50 } },
        // ... preserve rest of Phase 1 TanStack config ...
      });

      function goPrev() {
        // Pop the cursor stack — simplest: browser back, since each page push is a router.replace
        router.back();
      }
      function goNext() {
        if (nextCursor) setCursor(nextCursor);
      }

      return (
        <div>
          {/* PRESERVE Phase 1 search + filter chrome */}
          {/* PRESERVE Phase 1 table render */}

          {/* Pagination chrome (D-17): prev/next only, no total count */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              Showing {items.length} {items.length === 1 ? "item" : "items"}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={goPrev}>← Previous</Button>
              <Button variant="outline" size="sm" onClick={goNext} disabled={!nextCursor}>Next →</Button>
            </div>
          </div>
        </div>
      );
    }
    ```

    Preserve EVERY column def, sort logic, row action menu, empty state, filter UI from Phase 1.

    **Step 4.2 — `components/feature/inventory/ItemForm.tsx`:**

    The big one. Swap mock-store mutators → Server Actions; add the photo field per D-15.

    ```typescript
    "use client";
    import { useTransition, useState } from "react";
    import { useRouter } from "next/navigation";
    import { useForm } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { toast } from "sonner";
    import { createItem, updateItem } from "@/app/(app)/inventory/actions";
    import { CreateItemSchema, UpdateItemSchema, type CreateItemValues, type UpdateItemValues } from "@/lib/schemas/item";
    import { ItemPhotoField } from "./ItemPhotoField";
    import type { InventoryItem } from "@/lib/types/item";
    // ... Phase 1 imports for Field/Input/Button/Controller/Select ...

    type Mode = "create" | "edit";

    export function ItemForm({ initial, mode }: { initial?: InventoryItem; mode: Mode }) {
      const router = useRouter();
      const [pending, startTransition] = useTransition();
      const [photoUrl, setPhotoUrl] = useState<string | null>(initial?.photoUrl ?? null);

      const schema = mode === "create" ? CreateItemSchema : UpdateItemSchema;
      const { register, handleSubmit, setError, control, formState, watch } = useForm({
        resolver: zodResolver(schema),
        defaultValues: mode === "edit" && initial
          ? { /* map InventoryItem fields per Phase 1 */ }
          : { lowStockThreshold: 0 },
      });

      const sku = watch("sku") as string | undefined;

      function onSubmit(values: any) {
        const payload = { ...values, photoUrl };
        startTransition(async () => {
          if (mode === "create") {
            const res = await createItem(payload);
            if (!res.ok) {
              if (res.errors) {
                for (const [k, v] of Object.entries(res.errors)) {
                  setError(k as any, { message: v?.[0] ?? "Invalid" });
                }
              } else {
                toast.error(res.error ?? "Couldn't save — try again.");
              }
              return;
            }
            toast.success("Item created");
            router.push(`/inventory/${res.itemId}`);
          } else {
            if (!initial) return;
            const res = await updateItem(initial.id, payload);
            if (!res.ok) {
              if (res.errors) {
                for (const [k, v] of Object.entries(res.errors)) {
                  setError(k as any, { message: v?.[0] ?? "Invalid" });
                }
              } else {
                toast.error(res.error ?? "Couldn't save — try again.");
              }
              return;
            }
            toast.success("Item updated");
            router.push(`/inventory/${initial.id}`);
          }
        });
      }

      return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* PRESERVE Phase 1 fields: name, sku (disabled in edit mode), totalQty (create only),
              unit, category, notes, lowStockThreshold. Use shadcn v4 Field primitives. */}

          {/* D-15: Photo field */}
          {(sku || initial?.id) ? (
            <div>
              <label className="text-sm font-medium block mb-2">Photo (optional)</label>
              <ItemPhotoField
                itemId={(initial?.id ?? sku) as string}
                initialUrl={photoUrl}
                onChange={setPhotoUrl}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Enter a SKU before adding a photo.</p>
          )}

          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Saving…" : mode === "create" ? "Create item" : "Save changes"}
          </Button>
        </form>
      );
    }
    ```

    **Step 4.3 — `components/feature/inventory/RetireItemButton.tsx`:**

    Phase 1 imported `retireItem` from `@/lib/mock/store`. Swap:

    ```typescript
    "use client";
    import { useTransition } from "react";
    import { useRouter } from "next/navigation";
    import { toast } from "sonner";
    import { retireItem } from "@/app/(app)/inventory/actions";
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent /* ... */ } from "@/components/ui/alert-dialog";
    // ... preserve Phase 1 imports ...

    export function RetireItemButton({ itemId }: { itemId: string }) {
      const router = useRouter();
      const [pending, startTransition] = useTransition();

      function handleConfirm() {
        startTransition(async () => {
          const res = await retireItem(itemId);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Item retired");
          router.refresh();
        });
      }

      // PRESERVE Phase 1 AlertDialog destructive trigger + content
      return (
        <AlertDialog>
          {/* ... AlertDialogTrigger + Content + Action with onClick={handleConfirm} ... */}
        </AlertDialog>
      );
    }
    ```

    **Step 4.4 — `components/feature/inventory/ItemHistoryTab.tsx`:**

    Phase 1 used a mock selector `selectTransactionsForItem`. Swap to `useTransactionsLive({itemId})`:

    ```typescript
    "use client";
    import { useTransactionsLive } from "@/lib/hooks/use-transactions-live";

    export function ItemHistoryTab({ itemId }: { itemId: string }) {
      const txs = useTransactionsLive({ itemId, limit: 50 });
      // PRESERVE Phase 1 timeline / table rendering of transactions
      // ... map txs to existing AuditFeed component ...
    }
    ```

    **Step 4.5 — `components/feature/inventory/AdjustStockDialog.tsx`** (likely Phase 1 component; if not, create a minimal one):

    Swap to `adjustItemStock` Server Action:

    ```typescript
    "use client";
    import { useTransition } from "react";
    import { useForm } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { toast } from "sonner";
    import { adjustItemStock } from "@/app/(app)/inventory/actions";
    import { AdjustStockSchema } from "@/lib/schemas/item";
    // ... rest as Phase 1 ...

    export function AdjustStockDialog({ itemId, current }: { itemId: string; current: number }) {
      const [pending, startTransition] = useTransition();
      const { register, handleSubmit, setError, formState, reset } = useForm({
        resolver: zodResolver(AdjustStockSchema),
      });

      function onSubmit(values: { itemId: string; delta: number; reason: string }) {
        startTransition(async () => {
          const res = await adjustItemStock({ itemId, delta: values.delta, reason: values.reason });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Stock adjusted");
          reset();
        });
      }
      // PRESERVE Phase 1 dialog chrome + form layout
    }
    ```

    **Step 4.6 — `components/feature/settings/LowStockThresholdsCard.tsx`:**

    Swap `updateLowStockThreshold` from mock store to Server Action:

    ```typescript
    "use client";
    import { updateLowStockThreshold } from "@/app/(app)/inventory/actions";
    import { useInventoryLive } from "@/lib/hooks/use-inventory-live";
    // ... preserve Phase 1 chrome ...

    export function LowStockThresholdsCard({ initialItems }: { initialItems: InventoryItem[] }) {
      const items = useInventoryLive(initialItems);
      async function onSave(itemId: string, threshold: number) {
        const res = await updateLowStockThreshold(itemId, threshold);
        if (!res.ok) toast.error(res.error);
        else toast.success("Threshold updated");
      }
      // PRESERVE Phase 1 list/grid + inline edit UI
    }
    ```
  </action>
  <acceptance_criteria>
    - `grep -q "useInventoryLive" components/feature/inventory/InventoryTable.tsx` succeeds.
    - `grep -q "useMockStore" components/feature/inventory/InventoryTable.tsx` FAILS.
    - `grep -q "manualPagination: true" components/feature/inventory/InventoryTable.tsx` succeeds (D-17).
    - `grep -q "from \"@/app/(app)/inventory/actions\"" components/feature/inventory/ItemForm.tsx` succeeds.
    - `grep -q "ItemPhotoField" components/feature/inventory/ItemForm.tsx` succeeds (D-15).
    - `grep -q "from \"@/app/(app)/inventory/actions\"" components/feature/inventory/RetireItemButton.tsx` succeeds.
    - `grep -q "useTransactionsLive" components/feature/inventory/ItemHistoryTab.tsx` succeeds.
    - `grep -q "from \"@/app/(app)/inventory/actions\"" components/feature/inventory/AdjustStockDialog.tsx` succeeds.
    - `grep -q "from \"@/app/(app)/inventory/actions\"" components/feature/settings/LowStockThresholdsCard.tsx` succeeds.
    - No `seedUsers.find` calls in inventory components: `grep -rE "seedUsers" components/feature/inventory/ | wc -l` returns 0.
    - `grep -rq "from \"@/lib/mock/store\"" components/feature/inventory/` FAILS (all mock-store imports removed).
    - `npm run build` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -q "useInventoryLive" components/feature/inventory/InventoryTable.tsx && grep -q "manualPagination: true" components/feature/inventory/InventoryTable.tsx && grep -q "ItemPhotoField" components/feature/inventory/ItemForm.tsx && grep -q "useTransactionsLive" components/feature/inventory/ItemHistoryTab.tsx && [ "$(grep -rE 'seedUsers' components/feature/inventory/ 2>/dev/null | wc -l)" = "0" ] && npm run build</automated>
  </verify>
  <done>All 6 inventory + low-stock client components on Firebase. UI surface preserved + D-15 photo field added.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: E2E inventory flow + manual rules audit for inventory + storage</name>
  <what-built>
    Inventory list, detail, new, edit, photo upload, retire, adjust stock, low-stock thresholds all wired against Firebase. Now end-to-end test as admin + staff, and run manual Rules Playground audit.
  </what-built>
  <how-to-verify>
    **Step A — Create an item:**
    1. `npm run dev`. Sign in as admin.
    2. /inventory → "Create item". Fill SKU="TEST-001", name="Test microphone", totalQty=5, unit="ea", category="Audio", lowStockThreshold=2.
    3. After entering SKU, the photo field should activate. Click "Choose file" → pick any JPEG. Wait for "Photo uploaded" toast.
    4. Click "Create item". **Expected:** redirect to /inventory/TEST-001 with photo visible.
    5. In Firebase Console → Firestore → inventory → TEST-001: verify fields including `isLowStock: false`, `photoUrl` containing a valid Storage URL, `availableQty: 5`.
    6. In Firebase Console → Storage → items/TEST-001/photo.jpg: verify the photo exists, content type `image/jpeg`, size <300KB.

    **Step B — Edit + adjust stock:**
    1. /inventory/TEST-001 → click "Edit" → change name to "Test mic". Save.
    2. Click "Adjust stock" → delta=-3, reason="Damaged". Save.
    3. **Expected:** availableQty drops to 2. `isLowStock` flips to true (because 2 <= threshold 2). Dashboard low-stock widget should show this item on refresh.
    4. Item-detail History tab: should show 2 entries — "Stock adjusted: -3 (Damaged)" and (if Phase 1 hooks for create are wired) the create event.

    **Step C — Cursor pagination test:**
    1. Manually seed 51 items via the Firebase Console (or via UI / batch script). Or: just verify nextCursor URL appears when items >= 50.
    2. Navigate /inventory. If >=50 items: "Next →" button is enabled. Click it → URL changes to `?cursor=eyJ...`, page shows next batch.
    3. Click "← Previous" → router.back() returns to first page.

    **Step D — SKU collision:**
    1. /inventory/new → enter SKU="TEST-001" again. Submit.
    2. **Expected:** form shows inline error "SKU already exists." on the SKU field. No item created.

    **Step E — Stock invariant:**
    1. /inventory/TEST-001 → Adjust stock → delta=-100. Submit.
    2. **Expected:** toast.error: "Adjustment would create negative stock."

    **Step F — Retire while out (currently outQty=0 since no checkout yet):**
    1. Click "Retire". Confirm.
    2. **Expected:** item lifecycleState=retired; isLowStock=false in Firestore.
    3. Inventory list filter "Status: retired" — should show this item.

    **Step G — As staff (non-admin):**
    1. Sign out. Sign in as the staff user from 02-04 Task 7.
    2. /inventory — should render list (read access OK per INV-06).
    3. /inventory/new — **Expected:** redirect to /unauthorized.
    4. Try /inventory/TEST-001 - read OK. Try editing — should not see Edit button OR be blocked at the /edit page.

    **Step H — Manual rules audit (Block C) — record in CLAIM.md under `## Rules Audit — Block C`:**

    Firebase Console → Firestore → Rules Playground. Run:

    | # | Path | Auth? | Role | Op | Expected |
    |---|------|-------|------|-----|----------|
    | 1 | /inventory/TEST-001 | No | — | read | DENY |
    | 2 | /inventory/TEST-001 | Yes | staff | read | ALLOW |
    | 3 | /inventory/TEST-001 | Yes | admin | create | ALLOW (with valid data: availableQty>=0, <=totalQty) |
    | 4 | /inventory/TEST-001 | Yes | admin | update with availableQty: -1 | DENY (invariant) |
    | 5 | /inventory/TEST-001 | Yes | admin | update with availableQty: 100, totalQty: 5 | DENY (availableQty > totalQty invariant) |
    | 6 | /inventory/TEST-001 | Yes | staff | create | DENY |

    Also Storage Rules Playground:

    | # | Path | Auth? | Role | Op | Expected |
    |---|------|-------|------|-----|----------|
    | 7 | items/TEST-001/photo.jpg | No | — | read | DENY |
    | 8 | items/TEST-001/photo.jpg | Yes | staff | read | ALLOW |
    | 9 | items/TEST-001/photo.jpg | Yes | staff | write | DENY |
    | 10 | items/TEST-001/photo.jpg | Yes | admin | write (image/jpeg, <5MB) | ALLOW |

    Report: PASS/FAIL each + paste outcomes in CLAIM.md.

    **Step I — Phase 1 UI regression check:**
    Visit /inventory list, item detail, new, edit — confirm visual surface matches Phase 1 EXCEPT the photo field on new/edit (D-15 amendment). Pagination chrome now says "Showing N items" + Prev/Next instead of "Page X of Y" (D-17 amendment).

    Report PASS/FAIL.
  </how-to-verify>
  <resume-signal>Type "inventory E2E PASS, rules audit logged" or describe failures.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| URL ?cursor= | Untrusted opaque blob; server-side decoded via Buffer.from(base64).toString(utf8) → JSON.parse with try/catch fallback |
| URL filter params | Untrusted; rendered into Firestore where() — but only on whitelisted keys |
| Browser file picker → upload | Untrusted blob; compressed + JPEG-coerced + size capped by Storage rules |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-06-01 | Tampering | Cursor blob injected for cross-collection enumeration | accept | startAfter accepts arbitrary values; query is still scoped to inventory collection with where filters; worst case returns wrong page slice (harmless) |
| T-02-06-02 | Information disclosure | Cursor blob leaks data | accept | Cursor encodes only the last item's name + ID, both of which are already readable to signed-in users |
| T-02-06-03 | DoS | Listener leak on rapid filter changes | mitigate | useEffect cleanup function unsubscribes onSnapshot; cursor change clears + remounts |
| T-02-06-04 | Tampering | Storage upload with image/svg+xml containing JS | mitigate | upload-photo.ts forces fileType: 'image/jpeg' via browser-image-compression; original file replaced before upload |
| T-02-06-05 | Information disclosure | Stale download URL leaks photo to unauthenticated viewer | mitigate | Storage rules require auth on read; download URLs are TOKEN-LESS for non-public files; getDownloadURL requires signed-in caller |
| T-02-06-06 | Tampering | Edit photo overwrites someone else's item | mitigate | itemId path component is verified by Storage rules (admin-only write); no path traversal |
| T-02-06-07 | Repudiation | Photo replacement not audited | accept | Photo lifecycle is replace-only (D-14); no history tracking by design |
</threat_model>

<verification>
- All 4 Server Components use real DAL + getInventoryPage/getItemServer.
- All 6 Client Components on Firebase live hooks + Server Actions.
- ItemPhotoField present in /inventory/new and /inventory/[itemId]/edit (D-15 amendment).
- useUrlTableState exposes setCursor; setPage removed; filter changes clear cursor (P9).
- useTransactionsLive feeds item-detail audit tab.
- npm run build exits 0; tsc --noEmit exits 0; ESLint exits 0.
- Block C rules audit (10 test cases — 6 Firestore + 4 Storage) logged in CLAIM.md.
</verification>

<success_criteria>
- INV-01..10 all functional end-to-end (create, edit, retire, adjust, photo, audit, low-stock, list, filter, detail, QR label).
- INT-01 (atomic), INT-02 (rules invariant), INT-03 (transactions server-only) all wired and rules-audited.
- AUD-01/02/04 (audit row per state-changing inventory action, immutable, rendered on detail).
- REP-06 (shareable URL with filters + cursor).
- D-15 (photo field) live; D-17 (cursor URLs) live.
- D-06 manual audit for inventory + storage completed.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-02/02-06-inventory-ui-photo-and-cursor-SUMMARY.md` documenting:
- 13 files modified.
- Photo upload flow (file picker + camera + compression) tested end-to-end with file size noted.
- Cursor pagination demo (URL examples).
- Block C rules audit findings (10 cases).
- Any Phase 1 UI regression and resolution.
Summary <= 120 lines.
</output>
