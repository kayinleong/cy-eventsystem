---
phase: 01-ui-poc
plan: 06
type: execute
wave: 3
depends_on: [01, 02, 03, 04]
files_modified:
  - app/(app)/inventory/page.tsx
  - app/(app)/inventory/new/page.tsx
  - app/(app)/inventory/[itemId]/page.tsx
  - app/(app)/inventory/[itemId]/edit/page.tsx
  - components/feature/inventory/InventoryTable.tsx
  - components/feature/inventory/ItemForm.tsx
  - components/feature/inventory/ItemDetail.tsx
  - components/feature/inventory/ItemHistoryTab.tsx
  - components/feature/inventory/LabelPreview.tsx
  - components/feature/inventory/PrintLabelButton.tsx
  - components/feature/inventory/RetireItemButton.tsx
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
  - INV-10
  - AUD-02
  - AUD-04
  - REP-06
  - REP-07
  - NFR-05

must_haves:
  truths:
    - "/inventory lists all non-retired items in a DataTable with filter by category, lifecycle state, low-stock, free-text search; pagination at 50/page; URL params for q, category, lifecycle, page."
    - "/inventory/new admin-gated form creates an item via store.createItem with Zod validation (SKU regex, totalQty ≥ 0, name required)."
    - "/inventory/[itemId] renders detail + tabs (Details, History) + 'Print label' button + retire confirmation."
    - "/inventory/[itemId]/edit admin-gated form mutates via store.updateItem."
    - "Item detail page generates a real QR code via bwip-js for the SKU; print preview hides chrome via @media print."
    - "Retire confirmation uses AlertDialog with exact UI-SPEC copy: 'Retire this item?' / 'Retire item' confirm label."
    - "Item history tab shows chronological transactions for the item per AUD-02."
    - "Inventory list shows StatusBadge using lifecycleState mapping."
  artifacts:
    - path: "app/(app)/inventory/page.tsx"
      provides: "Inventory list — Server shell that renders the InventoryTable client island; URL state lives client-side in the table via useUrlTableState"
      contains: "InventoryTable"
    - path: "app/(app)/inventory/new/page.tsx"
      provides: "Admin-gated create form"
      contains: "requireAdmin"
    - path: "app/(app)/inventory/[itemId]/page.tsx"
      provides: "Detail view with tabs"
      contains: "await props.params"
    - path: "app/(app)/inventory/[itemId]/edit/page.tsx"
      provides: "Admin-gated edit form"
      contains: "requireAdmin"
    - path: "components/feature/inventory/InventoryTable.tsx"
      provides: "DataTable wrapper specifically for InventoryItem with column defs and category/lifecycle filters"
      contains: "DataTable"
    - path: "components/feature/inventory/ItemForm.tsx"
      provides: "rhf + zodResolver shared by /inventory/new and /inventory/[id]/edit"
      contains: "ItemFormSchema"
    - path: "components/feature/inventory/LabelPreview.tsx"
      provides: "bwip-js QR code rendered to canvas"
      contains: "bwipjs"
    - path: "components/feature/inventory/RetireItemButton.tsx"
      provides: "AlertDialog with UI-SPEC retire copy"
      contains: "Retire this item?"
  key_links:
    - from: "components/feature/inventory/InventoryTable.tsx"
      to: "components/feature/table/DataTable.tsx + lib/mock/store.ts"
      via: "useMockStore + DataTable wrapper with custom toolbar filter selects"
      pattern: "DataTable|useMockStore"
    - from: "components/feature/inventory/ItemForm.tsx"
      to: "lib/schemas/item.ts + lib/mock/store.ts"
      via: "zodResolver(ItemFormSchema) → store.createItem or store.updateItem"
      pattern: "ItemFormSchema|createItem|updateItem"
    - from: "components/feature/inventory/LabelPreview.tsx"
      to: "bwip-js"
      via: "bwipjs.toCanvas with bcid: 'qrcode'"
      pattern: "bwipjs.toCanvas"
---

<objective>
Build the entire inventory feature: list page with filterable DataTable, admin-gated create + edit forms with Zod validation, detail page with tabs (Details + History) including QR label preview via bwip-js, retire confirmation dialog.

Output: 4 route files + 7 feature components.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/phases/phase-kayinleong-01/01-UI-SPEC.md
@.planning/phases/phase-kayinleong-01/01-CONTEXT.md
@.planning/phases/phase-kayinleong-01/01-PATTERNS.md
@lib/types/item.ts
@lib/schemas/item.ts
@lib/mock/store.ts
@lib/mock/selectors.ts
@lib/mock/users.ts
@lib/auth/mock-session.ts
@lib/hooks/use-mock-store.ts
@lib/hooks/use-current-user.ts
@components/ui/page-header.tsx
@components/ui/empty-state.tsx
@components/ui/card.tsx
@components/ui/tabs.tsx
@components/ui/alert-dialog.tsx
@components/ui/dialog.tsx
@components/ui/form.tsx
@components/ui/input.tsx
@components/ui/textarea.tsx
@components/ui/select.tsx
@components/ui/button.tsx
@components/ui/badge.tsx
@components/feature/status/StatusBadge.tsx
@components/feature/status/status-to-tone.ts
@components/feature/table/DataTable.tsx
@components/feature/inventory/QtyStepper.tsx

<interfaces>
```tsx
// All client components in components/feature/inventory/
export function InventoryTable(): React.ReactElement;
export function ItemForm(props: { mode: "create" | "edit"; initial?: ItemFormInput; itemId?: string }): React.ReactElement;
export function ItemDetail(props: { item: InventoryItem }): React.ReactElement;
export function ItemHistoryTab(props: { itemId: string }): React.ReactElement;
export function LabelPreview(props: { value: string }): React.ReactElement;
export function PrintLabelButton(props: { sku: string; name: string }): React.ReactElement;
export function RetireItemButton(props: { itemId: string; itemName: string }): React.ReactElement;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Inventory list page + InventoryTable feature component</name>
  <files>
    app/(app)/inventory/page.tsx,
    components/feature/inventory/InventoryTable.tsx
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-01/01-PATTERNS.md "List pages with URL search params" (lines 367-389), "TanStack data-table" (lines 618-688)
    - .planning/phases/phase-kayinleong-01/01-CONTEXT.md D-09..D-12 (URL state, filter bar, sort, pagination chrome)
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md "Primary CTA" table (Add item), Status Palette (Q4)
    - .planning/REQUIREMENTS.md INV-06, INV-07, REP-06, REP-07
    - components/feature/table/DataTable.tsx (created Plan 03)
    - lib/mock/selectors.ts (selectLowStockItems for low-stock filter)
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md (searchParams section)
  </read_first>
  <action>
    **D-11 sortable-columns rule (see Plan 03 Task 2 action for the verbatim quote):** This table's sortable columns are `name`, `sku`, `availableQty`, `lifecycleState`. The `category` and `outQty` columns render plain string headers — NO `toggleSorting()` button, NO `ArrowUpDown` icon. Carry the comment `// D-11: <col> is NOT sortable` on each excluded column.

    **app/(app)/inventory/page.tsx** (Server shell hands searchParams to client table):
    ```tsx
    import type { Metadata } from "next";
    import Link from "next/link";
    import { Plus } from "lucide-react";
    import { PageHeader } from "@/components/ui/page-header";
    import { Button } from "@/components/ui/button";
    import { getMockSession } from "@/lib/auth/mock-session";
    import { InventoryTable } from "@/components/feature/inventory/InventoryTable";

    export const metadata: Metadata = { title: "Inventory" };

    export default async function InventoryListPage() {
      const session = await getMockSession();
      const isAdmin = session?.role === "admin";
      return (
        <div className="space-y-6">
          <PageHeader
            title="Inventory"
            description="Browse, filter, and manage your equipment."
            action={
              isAdmin ? (
                <Button asChild>
                  <Link href="/inventory/new"><Plus className="mr-2 size-4" />Add item</Link>
                </Button>
              ) : null
            }
          />
          <InventoryTable />
        </div>
      );
    }
    ```

    **components/feature/inventory/InventoryTable.tsx**:
    ```tsx
    "use client";
    import { useMemo } from "react";
    import Link from "next/link";
    import { Package, ArrowUpDown } from "lucide-react";
    import type { ColumnDef } from "@tanstack/react-table";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
    import type { InventoryItem, ItemLifecycleState, ItemCategory } from "@/lib/types/item";
    import { DataTable } from "@/components/feature/table/DataTable";
    import { StatusBadge } from "@/components/feature/status/StatusBadge";
    import { statusToTone, statusToLabel } from "@/components/feature/status/status-to-tone";
    import { Button } from "@/components/ui/button";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { EmptyState } from "@/components/ui/empty-state";

    const CATEGORIES: ItemCategory[] = ["Audio", "Lighting", "Display", "Marketing"];
    const LIFECYCLES: ItemLifecycleState[] = ["available", "checked_out", "damaged", "retired"];

    export function InventoryTable() {
      const items = useMockStore((s) => s.items);
      const { state: url, setFilter } = useUrlTableState(["category", "lifecycle", "lowStock"]);

      const filtered = useMemo(() => {
        return items.filter((i) => {
          if (url.filters.category && i.category !== url.filters.category) return false;
          if (url.filters.lifecycle && i.lifecycleState !== url.filters.lifecycle) return false;
          if (url.filters.lowStock === "true") {
            if (!(i.lowStockThreshold > 0 && i.availableQty <= i.lowStockThreshold && !i.lowStockOrderedAt)) return false;
          }
          if (url.q) {
            const q = url.q.toLowerCase();
            if (!i.name.toLowerCase().includes(q) && !i.sku.toLowerCase().includes(q)) return false;
          }
          return true;
        });
      }, [items, url.filters.category, url.filters.lifecycle, url.filters.lowStock, url.q]);

      const columns: ColumnDef<InventoryItem>[] = useMemo(() => [
        {
          accessorKey: "name",
          header: ({ column }) => (
            <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
              Name <ArrowUpDown className="ml-2 size-3" />
            </Button>
          ),
          cell: ({ row }) => (
            <Link href={`/inventory/${row.original.id}`} className="font-medium hover:underline">
              {row.original.name}
            </Link>
          ),
        },
        {
          accessorKey: "sku",
          header: "SKU",
          cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku}</span>,
        },
        {
          accessorKey: "category",
          header: "Category",
        },
        {
          accessorKey: "availableQty",
          header: ({ column }) => (
            <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
              Available <ArrowUpDown className="ml-2 size-3" />
            </Button>
          ),
          cell: ({ row }) => (
            <span>
              {row.original.availableQty} <span className="text-muted-foreground text-xs">/ {row.original.totalQty}</span>
            </span>
          ),
        },
        {
          accessorKey: "outQty",
          header: "Out",
          cell: ({ row }) => row.original.outQty,
        },
        {
          accessorKey: "lifecycleState",
          header: ({ column }) => (
            <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
              Status <ArrowUpDown className="ml-2 size-3" />
            </Button>
          ),
          cell: ({ row }) => (
            <StatusBadge tone={statusToTone(row.original.lifecycleState)}>
              {statusToLabel(row.original.lifecycleState)}
            </StatusBadge>
          ),
        },
      ], []);

      return (
        <DataTable<InventoryItem>
          columns={columns}
          data={filtered}
          filterKeys={["category", "lifecycle", "lowStock"]}
          globalFilterPlaceholder="Search name or SKU…"
          emptyState={
            <EmptyState
              icon={Package}
              heading="No items yet"
              body="Add your first inventory item to get started."
              action={
                <Button asChild>
                  <Link href="/inventory/new">Add item</Link>
                </Button>
              }
            />
          }
          toolbarExtras={
            <>
              <Select
                value={url.filters.category ?? "_all"}
                onValueChange={(v) => setFilter("category", v === "_all" ? undefined : v)}
              >
                <SelectTrigger className="w-40"><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All categories</SelectItem>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={url.filters.lifecycle ?? "_all"}
                onValueChange={(v) => setFilter("lifecycle", v === "_all" ? undefined : v)}
              >
                <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All statuses</SelectItem>
                  {LIFECYCLES.map((l) => <SelectItem key={l} value={l}>{statusToLabel(l)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                variant={url.filters.lowStock === "true" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("lowStock", url.filters.lowStock === "true" ? undefined : "true")}
              >
                Low stock only
              </Button>
            </>
          }
        />
      );
    }
    ```
  </action>
  <verify>
    <automated>ls app/(app)/inventory/page.tsx components/feature/inventory/InventoryTable.tsx; grep -q "PageHeader" app/(app)/inventory/page.tsx; grep -q "InventoryTable" app/(app)/inventory/page.tsx; grep -q "DataTable" components/feature/inventory/InventoryTable.tsx; grep -q "useUrlTableState" components/feature/inventory/InventoryTable.tsx; grep -q "Audio" components/feature/inventory/InventoryTable.tsx; grep -q "lowStock" components/feature/inventory/InventoryTable.tsx; grep -q "No items yet" components/feature/inventory/InventoryTable.tsx; grep -q "Add your first inventory item" components/feature/inventory/InventoryTable.tsx; npx tsc --noEmit; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - Both files exist.
    - InventoryTable uses DataTable wrapper + useUrlTableState with `["category", "lifecycle", "lowStock"]` keys.
    - Empty state uses UI-SPEC copy "No items yet" / "Add your first inventory item to get started." exactly.
    - npx tsc --noEmit exits 0; npm run build exits 0.
  </acceptance_criteria>
  <done>List page + filterable table compile and render seeded items.</done>
</task>

<task type="auto">
  <name>Task 2: Create + edit forms + ItemForm component (shared)</name>
  <files>
    app/(app)/inventory/new/page.tsx,
    app/(app)/inventory/[itemId]/edit/page.tsx,
    components/feature/inventory/ItemForm.tsx
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-01/01-PATTERNS.md "Per-route role gate" (lines 314-342), "Sign-in form" (lines 518-585) for rhf pattern, "Shared #3 — Form pattern" (lines 1097-1108)
    - lib/schemas/item.ts (ItemFormSchema)
    - lib/mock/store.ts (createItem, updateItem signatures)
    - .planning/REQUIREMENTS.md INV-01, INV-02 (SKU uniqueness), INV-03
    - components/ui/form.tsx (shadcn Form components)
  </read_first>
  <action>
    **components/feature/inventory/ItemForm.tsx** (shared between new + edit):
    ```tsx
    "use client";
    import { useState } from "react";
    import { useForm } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { useRouter } from "next/navigation";
    import { toast } from "sonner";
    import { ItemFormSchema, ItemCategoryEnum, type ItemFormInput } from "@/lib/schemas/item";
    import { createItem, updateItem, getSnapshot } from "@/lib/mock/store";
    import { seedUsers } from "@/lib/mock/users";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";
    import {
      Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
    } from "@/components/ui/form";
    import { Input } from "@/components/ui/input";
    import { Textarea } from "@/components/ui/textarea";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { Button } from "@/components/ui/button";

    export function ItemForm({
      mode,
      initial,
      itemId,
    }: {
      mode: "create" | "edit";
      initial?: ItemFormInput;
      itemId?: string;
    }) {
      const router = useRouter();
      const session = useCurrentUser();
      const [submitting, setSubmitting] = useState(false);

      const form = useForm<ItemFormInput>({
        resolver: zodResolver(ItemFormSchema),
        mode: "onBlur",
        defaultValues: initial ?? {
          name: "", sku: "", category: "Audio", totalQty: 0, unit: "pcs",
          photoUrl: "", notes: "", lowStockThreshold: 0,
        },
      });

      function onSubmit(values: ItemFormInput) {
        const actor = session ? seedUsers.find((u) => u.uid === session.uid) : undefined;
        if (!actor) { toast.error("Couldn't save changes"); return; }

        if (mode === "create") {
          // INV-02 SKU uniqueness check
          const existing = getSnapshot().items.find((i) => i.sku.toLowerCase() === values.sku.toLowerCase());
          if (existing) {
            form.setError("sku", { message: "An item with this SKU already exists." });
            return;
          }
          setSubmitting(true);
          createItem({
            name: values.name,
            sku: values.sku.toUpperCase(),
            category: values.category,
            totalQty: values.totalQty,
            unit: values.unit,
            photoUrl: values.photoUrl && values.photoUrl !== "" ? values.photoUrl : null,
            notes: values.notes,
            lowStockThreshold: values.lowStockThreshold,
          }, actor);
          toast.success("Item added");
          router.push(`/inventory/${values.sku.toUpperCase()}`);
        } else if (itemId) {
          setSubmitting(true);
          updateItem(itemId, {
            name: values.name,
            category: values.category,
            unit: values.unit,
            photoUrl: values.photoUrl && values.photoUrl !== "" ? values.photoUrl : null,
            notes: values.notes,
            lowStockThreshold: values.lowStockThreshold,
            // INV-04: totalQty is intentionally NOT updated here — it requires the stock-adjust flow (Phase 2 surface)
          }, actor);
          toast.success("Item updated");
          router.push(`/inventory/${itemId}`);
        }
        setSubmitting(false);
      }

      return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Shure SM58 wireless mic" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl><Input className="font-mono" placeholder="AUD-MIC-XX" disabled={mode === "edit"} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {ItemCategoryEnum.options.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="totalQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total quantity</FormLabel>
                    <FormControl>
                      <Input type="number" inputMode="numeric" disabled={mode === "edit"} value={field.value} onChange={(e) => field.onChange(Number(e.target.value || 0))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl><Input placeholder="pcs" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="lowStockThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Low-stock threshold</FormLabel>
                  <FormControl>
                    <Input type="number" inputMode="numeric" value={field.value} onChange={(e) => field.onChange(Number(e.target.value || 0))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="photoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Photo URL (optional)</FormLabel>
                  <FormControl><Input type="url" placeholder="https://..." {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea rows={4} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{mode === "create" ? "Add item" : "Save changes"}</Button>
            </div>
          </form>
        </Form>
      );
    }
    ```

    **app/(app)/inventory/new/page.tsx**:
    ```tsx
    import type { Metadata } from "next";
    import { PageHeader } from "@/components/ui/page-header";
    import { requireAdmin } from "@/lib/auth/mock-session";
    import { ItemForm } from "@/components/feature/inventory/ItemForm";

    export const metadata: Metadata = { title: "Add item" };

    export default async function NewItemPage() {
      await requireAdmin();
      return (
        <div className="space-y-6">
          <PageHeader title="Add item" description="Create a new inventory item." />
          <ItemForm mode="create" />
        </div>
      );
    }
    ```

    **app/(app)/inventory/[itemId]/edit/page.tsx**:
    ```tsx
    import type { Metadata } from "next";
    import { notFound } from "next/navigation";
    import { PageHeader } from "@/components/ui/page-header";
    import { requireAdmin } from "@/lib/auth/mock-session";
    import { getSnapshot } from "@/lib/mock/store";
    import { selectItemById } from "@/lib/mock/selectors";
    import { ItemForm } from "@/components/feature/inventory/ItemForm";

    export const metadata: Metadata = { title: "Edit item" };

    type RouteProps = { params: Promise<{ itemId: string }> };

    export default async function EditItemPage({ params }: RouteProps) {
      await requireAdmin();
      const { itemId } = await params;
      const item = selectItemById(getSnapshot(), itemId);
      if (!item) notFound();
      return (
        <div className="space-y-6">
          <PageHeader title="Edit item" description={`Update ${item.name}.`} />
          <ItemForm
            mode="edit"
            itemId={itemId}
            initial={{
              name: item.name,
              sku: item.sku,
              category: item.category,
              totalQty: item.totalQty,
              unit: item.unit,
              photoUrl: item.photoUrl ?? "",
              notes: item.notes,
              lowStockThreshold: item.lowStockThreshold,
            }}
          />
        </div>
      );
    }
    ```
  </action>
  <verify>
    <automated>ls app/(app)/inventory/new/page.tsx app/(app)/inventory/[itemId]/edit/page.tsx components/feature/inventory/ItemForm.tsx; grep -q "requireAdmin" app/(app)/inventory/new/page.tsx; grep -q "requireAdmin" app/(app)/inventory/[itemId]/edit/page.tsx; grep -q "await params" app/(app)/inventory/[itemId]/edit/page.tsx; grep -q "ItemFormSchema" components/feature/inventory/ItemForm.tsx; grep -q "createItem" components/feature/inventory/ItemForm.tsx; grep -q "updateItem" components/feature/inventory/ItemForm.tsx; grep -q "SKU already exists" components/feature/inventory/ItemForm.tsx; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - All 3 files exist.
    - Both route files call `requireAdmin()`.
    - Edit route uses `await params` per Next 16 async APIs.
    - ItemForm enforces SKU uniqueness via getSnapshot() check (INV-02).
    - npx tsc --noEmit exits 0.
  </acceptance_criteria>
  <done>Admin-only create + edit flows compile and validate per Zod schema, tsc passes.</done>
</task>

<task type="auto">
  <name>Task 3: Item detail page + history tab + label preview + retire button</name>
  <files>
    app/(app)/inventory/[itemId]/page.tsx,
    components/feature/inventory/ItemDetail.tsx,
    components/feature/inventory/ItemHistoryTab.tsx,
    components/feature/inventory/LabelPreview.tsx,
    components/feature/inventory/PrintLabelButton.tsx,
    components/feature/inventory/RetireItemButton.tsx
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-01/01-PATTERNS.md "Dynamic-route pages" (lines 345-365), "Print label" (lines 955-988), "Shared #7 — Destructive confirmations" (lines 1144-1167)
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md destructive confirmations table (line 224 Retire row) — title + body + confirm label are LOCKED COPY
    - .planning/REQUIREMENTS.md INV-05 (soft-delete via retired), INV-08 (detail page with stock breakdown + chronological history), INV-10 (QR label), AUD-02
    - lib/mock/selectors.ts (selectItemById, selectTransactionsForItem)
    - lib/mock/store.ts (retireItem)
    - bwip-js documentation (`bwip-js/browser` — `bwipjs.toCanvas({ bcid: "qrcode", text, scale, includetext })`)
    - components/ui/tabs.tsx (shadcn — Tabs, TabsList, TabsTrigger, TabsContent)
  </read_first>
  <action>
    **components/feature/inventory/LabelPreview.tsx**:
    ```tsx
    "use client";
    import { useEffect, useRef } from "react";
    import bwipjs from "bwip-js/browser";

    export function LabelPreview({ value }: { value: string }) {
      const canvasRef = useRef<HTMLCanvasElement>(null);
      useEffect(() => {
        if (!canvasRef.current) return;
        try {
          bwipjs.toCanvas(canvasRef.current, {
            bcid: "qrcode",
            text: value,
            scale: 4,
            includetext: false,
            paddingwidth: 8,
            paddingheight: 8,
          });
        } catch (err) {
          console.error("[LabelPreview] bwipjs failed", err);
        }
      }, [value]);
      return <canvas ref={canvasRef} className="bg-white rounded" aria-label={`QR code for ${value}`} />;
    }
    ```

    **components/feature/inventory/PrintLabelButton.tsx** (Dialog with @media print hide-chrome):
    ```tsx
    "use client";
    import { useState } from "react";
    import { Printer } from "lucide-react";
    import {
      Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
    } from "@/components/ui/dialog";
    import { Button } from "@/components/ui/button";
    import { LabelPreview } from "./LabelPreview";

    export function PrintLabelButton({ sku, name }: { sku: string; name: string }) {
      const [open, setOpen] = useState(false);
      function doPrint() {
        if (typeof window === "undefined") return;
        window.print();
      }
      return (
        <>
          {/* PHASE 1: scoped print styles. Wrapping in an id-targeted block per UI-SPEC. */}
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #print-label, #print-label * { visibility: visible !important; }
              #print-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
            }
          `}</style>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Printer className="mr-2 size-4" /> Print label
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>QR label</DialogTitle></DialogHeader>
              <div id="print-label" className="flex flex-col items-center gap-2 py-4">
                <LabelPreview value={sku} />
                <p className="font-mono text-sm">{sku}</p>
                <p className="text-sm text-muted-foreground">{name}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
                <Button onClick={doPrint}>Print</Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    ```

    **components/feature/inventory/RetireItemButton.tsx** (UI-SPEC destructive confirm — exact copy):
    ```tsx
    "use client";
    import { useRouter } from "next/navigation";
    import { Trash2 } from "lucide-react";
    import {
      AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
      AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
      AlertDialogTitle, AlertDialogTrigger,
    } from "@/components/ui/alert-dialog";
    import { Button } from "@/components/ui/button";
    import { retireItem } from "@/lib/mock/store";
    import { seedUsers } from "@/lib/mock/users";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";
    import { toast } from "sonner";

    export function RetireItemButton({ itemId, itemName }: { itemId: string; itemName: string }) {
      const router = useRouter();
      const session = useCurrentUser();
      if (session?.role !== "admin") return null;

      function confirmRetire() {
        const actor = seedUsers.find((u) => u.uid === session?.uid);
        if (!actor) { toast.error("Couldn't retire item"); return; }
        retireItem(itemId, actor);
        toast(`${itemName} retired`); // UI-SPEC action toast
        router.push("/inventory");
      }

      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive"><Trash2 className="mr-2 size-4" /> Retire</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Retire this item?</AlertDialogTitle>
              <AlertDialogDescription>
                It will be removed from active inventory and won&apos;t appear in scans or events. Past history is kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRetire} className="bg-destructive/10 text-destructive hover:bg-destructive/20">
                Retire item
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }
    ```

    **components/feature/inventory/ItemHistoryTab.tsx** (AUD-02 chronological transaction feed):
    ```tsx
    "use client";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { selectTransactionsForItem } from "@/lib/mock/selectors";
    import { StatusBadge } from "@/components/feature/status/StatusBadge";
    import { statusToTone, statusToLabel } from "@/components/feature/status/status-to-tone";
    import { EmptyState } from "@/components/ui/empty-state";
    import { Activity } from "lucide-react";
    import Link from "next/link";

    export function ItemHistoryTab({ itemId }: { itemId: string }) {
      const txs = useMockStore((s) => selectTransactionsForItem(s, itemId));
      if (txs.length === 0) {
        return <EmptyState icon={Activity} heading="No activity yet" body="Transactions involving this item will appear here." />;
      }
      return (
        <ul className="divide-y divide-border">
          {txs.map((t) => (
            <li key={t.id} className="py-3 flex items-start gap-3">
              <StatusBadge tone={statusToTone(t.type)} className="mt-0.5">{statusToLabel(t.type)}</StatusBadge>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{t.actorName}</span>{" "}
                  {t.type === "checkout" ? "checked out" : t.type === "checkin" ? "returned" : t.type === "missing" ? "flagged missing" : "adjusted"}{" "}
                  <span className="font-medium">{t.qty}</span>
                  {t.eventId ? <> for <Link href={`/events/${t.eventId}`} className="hover:underline">{t.eventName}</Link></> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.at).toLocaleString()} · role: {t.actorRoleAtTimeOfAction}
                </p>
                {t.notes ? <p className="text-xs text-muted-foreground mt-1">{t.notes}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      );
    }
    ```

    **components/feature/inventory/ItemDetail.tsx** (shared by detail route — Server-friendly except for Tabs + History tab which are client):
    ```tsx
    import Link from "next/link";
    import { Edit } from "lucide-react";
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { Button } from "@/components/ui/button";
    import { StatusBadge } from "@/components/feature/status/StatusBadge";
    import { statusToTone, statusToLabel } from "@/components/feature/status/status-to-tone";
    import type { InventoryItem } from "@/lib/types/item";
    import { ItemHistoryTab } from "./ItemHistoryTab";
    import { PrintLabelButton } from "./PrintLabelButton";
    import { RetireItemButton } from "./RetireItemButton";

    export function ItemDetail({ item, isAdmin }: { item: InventoryItem; isAdmin: boolean }) {
      return (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold">{item.name}</h1>
                <StatusBadge tone={statusToTone(item.lifecycleState)}>
                  {statusToLabel(item.lifecycleState)}
                </StatusBadge>
              </div>
              <p className="font-mono text-sm text-muted-foreground">{item.sku}</p>
              <p className="text-sm text-muted-foreground">{item.category}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <PrintLabelButton sku={item.sku} name={item.name} />
              {isAdmin ? (
                <Button asChild variant="outline">
                  <Link href={`/inventory/${item.id}/edit`}><Edit className="mr-2 size-4" />Edit</Link>
                </Button>
              ) : null}
              {isAdmin ? <RetireItemButton itemId={item.id} itemName={item.name} /> : null}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total", value: item.totalQty },
              { label: "Available", value: item.availableQty },
              { label: "Out", value: item.outQty },
              { label: "Damaged", value: item.damagedQty },
            ].map((s) => (
              <Card key={s.label}>
                <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-semibold">{s.value}</p></CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-3 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">Unit</dt><dd>{item.unit}</dd></div>
                <div><dt className="text-muted-foreground">Low-stock threshold</dt><dd>{item.lowStockThreshold}</dd></div>
                <div className="md:col-span-2"><dt className="text-muted-foreground">Notes</dt><dd>{item.notes || <span className="text-muted-foreground">—</span>}</dd></div>
              </div>
            </TabsContent>
            <TabsContent value="history" className="pt-4">
              <ItemHistoryTab itemId={item.id} />
            </TabsContent>
          </Tabs>
        </div>
      );
    }
    ```

    **app/(app)/inventory/[itemId]/page.tsx**:
    ```tsx
    import type { Metadata } from "next";
    import { notFound } from "next/navigation";
    import { getSnapshot } from "@/lib/mock/store";
    import { selectItemById } from "@/lib/mock/selectors";
    import { getMockSession } from "@/lib/auth/mock-session";
    import { ItemDetail } from "@/components/feature/inventory/ItemDetail";

    type RouteProps = { params: Promise<{ itemId: string }> };

    export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
      const { itemId } = await params;
      const item = selectItemById(getSnapshot(), itemId);
      return { title: item ? item.name : "Item not found" };
    }

    export default async function ItemDetailPage({ params }: RouteProps) {
      const { itemId } = await params;
      const item = selectItemById(getSnapshot(), itemId);
      if (!item) notFound();
      const session = await getMockSession();
      const isAdmin = session?.role === "admin";
      return <ItemDetail item={item} isAdmin={isAdmin} />;
    }
    ```

    Critical:
    - All client components have `'use client'` on line 1.
    - Detail page reads snapshot once on the server then hands the snapshot's item to the client island ItemDetail; the history tab subscribes to the live store via useMockStore so retire/edit mutations re-render.
    - Print preview uses inline `<style>` per UI-SPEC pattern (scoped within the PrintLabelButton component).
  </action>
  <verify>
    <automated>ls app/(app)/inventory/[itemId]/page.tsx components/feature/inventory/ItemDetail.tsx components/feature/inventory/ItemHistoryTab.tsx components/feature/inventory/LabelPreview.tsx components/feature/inventory/PrintLabelButton.tsx components/feature/inventory/RetireItemButton.tsx | wc -l | grep -q "^6$"; grep -q "await params" app/(app)/inventory/[itemId]/page.tsx; grep -q "notFound" app/(app)/inventory/[itemId]/page.tsx; grep -q "bwipjs.toCanvas" components/feature/inventory/LabelPreview.tsx; grep -q "qrcode" components/feature/inventory/LabelPreview.tsx; grep -q "Retire this item" components/feature/inventory/RetireItemButton.tsx; grep -q "Retire item" components/feature/inventory/RetireItemButton.tsx; grep -q "Tabs" components/feature/inventory/ItemDetail.tsx; grep -q "selectTransactionsForItem" components/feature/inventory/ItemHistoryTab.tsx; grep -q "actorRoleAtTimeOfAction" components/feature/inventory/ItemHistoryTab.tsx; npx tsc --noEmit; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - All 6 files exist.
    - Detail route uses `await params` (Next 16) and calls `notFound()` for missing items.
    - LabelPreview calls `bwipjs.toCanvas` with `bcid: "qrcode"`.
    - RetireItemButton uses EXACT UI-SPEC copy: title `"Retire this item?"`, confirm label `"Retire item"` (verify via grep).
    - ItemDetail uses Tabs with Details + History tabs.
    - ItemHistoryTab calls `selectTransactionsForItem` and renders `actorRoleAtTimeOfAction`.
    - npx tsc --noEmit + npm run build both exit 0.
  </acceptance_criteria>
  <done>Detail page renders, QR label prints, retire AlertDialog uses locked copy, history feed shows transactions, tsc + build pass.</done>
</task>

</tasks>

<verification>
- /inventory: list renders 30 seed items with filters working via URL params (q, category, lifecycle, lowStock).
- /inventory/new: admin-only; staff redirects to /unauthorized; create flow adds item to store and toasts success.
- /inventory/[itemId]: stock cards, QR label dialog, retire dialog all reachable; history tab lists item's transactions.
- /inventory/[itemId]/edit: admin-only; SKU + totalQty disabled in edit mode (INV-04 stock-adjust flow is Phase 2).
- npm run build passes.
- npx tsc --noEmit passes.
</verification>

<success_criteria>
INV-01..10, AUD-02, AUD-04, REP-06, REP-07 satisfied at UI level.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-01/01-06-inventory-SUMMARY.md` summarizing the 11 files created, the SKU-uniqueness enforcement, and the bwip-js print pipeline.
</output>
