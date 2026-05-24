---
phase: 01-ui-poc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - components.json
  - components/ui/input.tsx
  - components/ui/label.tsx
  - components/ui/textarea.tsx
  - components/ui/select.tsx
  - components/ui/checkbox.tsx
  - components/ui/radio-group.tsx
  - components/ui/switch.tsx
  - components/ui/form.tsx
  - components/ui/card.tsx
  - components/ui/badge.tsx
  - components/ui/table.tsx
  - components/ui/dialog.tsx
  - components/ui/alert-dialog.tsx
  - components/ui/sheet.tsx
  - components/ui/dropdown-menu.tsx
  - components/ui/tabs.tsx
  - components/ui/tooltip.tsx
  - components/ui/breadcrumb.tsx
  - components/ui/separator.tsx
  - components/ui/skeleton.tsx
  - components/ui/avatar.tsx
  - components/ui/sonner.tsx
  - components/ui/command.tsx
  - components/ui/popover.tsx
  - components/ui/calendar.tsx
  - components/ui/progress.tsx
  - components/ui/scroll-area.tsx
  - lib/types/item.ts
  - lib/types/event.ts
  - lib/types/user.ts
  - lib/types/transaction.ts
  - lib/types/missing-item.ts
  - lib/types/session.ts
  - lib/schemas/item.ts
  - lib/schemas/event.ts
  - lib/schemas/user.ts
  - lib/schemas/transaction.ts
  - lib/schemas/missing-item.ts
  - lib/schemas/auth.ts
autonomous: true
requirements:
  - NFR-01
  - NFR-02
  - NFR-03
  - NFR-04
  - NFR-09

must_haves:
  truths:
    - "All Phase 1 npm dependencies are installed in package.json (no missing-module errors)."
    - "All 27 shadcn registry components exist under components/ui/ via the CLI (not hand-authored)."
    - "Entity types in lib/types/ mirror the Firestore schemas in .planning/research/ARCHITECTURE.md."
    - "Zod schemas in lib/schemas/ produce inferred types identical to lib/types/ for shared use server↔client."
    - "tsc --noEmit succeeds on the new types and schemas."
  artifacts:
    - path: "lib/types/item.ts"
      provides: "InventoryItem, ItemLifecycleState, ItemCategory types"
      contains: "export type InventoryItem"
    - path: "lib/types/event.ts"
      provides: "EventDoc, EventStatus types"
      contains: "export type EventDoc"
    - path: "lib/types/user.ts"
      provides: "UserDoc, UserRole types"
      contains: "export type UserDoc"
    - path: "lib/types/transaction.ts"
      provides: "TransactionDoc, TransactionType types"
      contains: "export type TransactionDoc"
    - path: "lib/types/missing-item.ts"
      provides: "MissingItemDoc, MissingReason, MissingStatus types"
      contains: "export type MissingItemDoc"
    - path: "lib/types/session.ts"
      provides: "Session type matching CONTEXT.md D-05 cookie shape"
      contains: "export type Session"
    - path: "lib/schemas/item.ts"
      provides: "ItemSchema Zod schema with refine() for available+out=total invariant"
      contains: "z.object"
    - path: "lib/schemas/auth.ts"
      provides: "LoginSchema, ForgotPasswordSchema, SetPasswordSchema"
      contains: "LoginSchema"
    - path: "package.json"
      provides: "All Phase 1 runtime deps installed"
      contains: "next-themes"
  key_links:
    - from: "lib/schemas/item.ts"
      to: "lib/types/item.ts"
      via: "z.infer<typeof ItemSchema> equals InventoryItem (or types alias)"
      pattern: "z\\.infer|z\\.output"
    - from: "lib/types/*.ts"
      to: ".planning/research/ARCHITECTURE.md"
      via: "Field names + types mirror Firestore schemas exactly"
      pattern: "availableQty|outQty|totalQty|allowedStaff|parentTxId"
---

<objective>
Install every Phase 1 runtime dependency, scaffold all 27 shadcn UI components via the CLI, and create the strict TypeScript types + Zod schemas that mirror the Firestore data model in ARCHITECTURE.md.

Purpose: This is the foundation every other Wave 1+ plan depends on. Without these deps, types, and schemas, no other plan can compile.

Output: Updated `package.json` + `package-lock.json`, 27 new `components/ui/*.tsx` files, 6 new `lib/types/*.ts` files, 6 new `lib/schemas/*.ts` files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@CLAUDE.md
@AGENTS.md
@.planning/phases/phase-kayinleong-01/01-CONTEXT.md
@.planning/phases/phase-kayinleong-01/01-UI-SPEC.md
@.planning/phases/phase-kayinleong-01/01-PATTERNS.md
@.planning/research/STACK.md
@.planning/research/ARCHITECTURE.md
@components.json
@package.json
@components/ui/button.tsx
@lib/utils.ts

<interfaces>
<!-- Existing shape for shadcn components: components/ui/button.tsx uses cva + radix-ui umbrella import (NOT @radix-ui/react-*). Schema files must mirror Firestore field names exactly. -->

Firestore schemas to mirror (from .planning/research/ARCHITECTURE.md):

```
users/{uid}: { uid, email, displayName, role: "admin"|"staff", disabled, createdAt, createdBy, lastLoginAt }
inventory/{itemId}: { name, sku, category, totalQty, availableQty, outQty, unit, photoUrl, notes, createdAt, updatedAt, createdBy, updatedBy }
events/{eventId}: { name, startDate, endDate, status: "planned"|"active"|"completed"|"cancelled", location, description, teamLeads, backupTeams, allowedStaff, plannedItems, createdAt, createdBy, closedAt, closedBy }
transactions/{txId}: { type: "checkout"|"checkin"|"adjustment"|"missing", itemId, itemSku, itemName, eventId, eventName, qty, actorUid, actorName, at, notes, parentTxId, clientTxId }
missingItems/{missingId}: { itemId, itemName, eventId, eventName, qty, reason: "Lost"|"Damaged"|"Not returned"|"Unknown", reportedBy, reportedAt, status: "open"|"found"|"writtenOff", resolvedAt, resolvedBy, parentCheckinTxId }
```

CONTEXT.md D-05 session shape: `{ uid, displayName, email, role, disabled }`.

Item lifecycle states (INV-09): "available" | "checked_out" | "damaged" | "retired".
Item categories (D-03): "Audio" | "Lighting" | "Display" | "Marketing".
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install runtime deps + scaffold all 27 shadcn UI components via CLI</name>
  <files>
    package.json,
    components.json,
    components/ui/input.tsx,
    components/ui/label.tsx,
    components/ui/textarea.tsx,
    components/ui/select.tsx,
    components/ui/checkbox.tsx,
    components/ui/radio-group.tsx,
    components/ui/switch.tsx,
    components/ui/form.tsx,
    components/ui/card.tsx,
    components/ui/badge.tsx,
    components/ui/table.tsx,
    components/ui/dialog.tsx,
    components/ui/alert-dialog.tsx,
    components/ui/sheet.tsx,
    components/ui/dropdown-menu.tsx,
    components/ui/tabs.tsx,
    components/ui/tooltip.tsx,
    components/ui/breadcrumb.tsx,
    components/ui/separator.tsx,
    components/ui/skeleton.tsx,
    components/ui/avatar.tsx,
    components/ui/sonner.tsx,
    components/ui/command.tsx,
    components/ui/popover.tsx,
    components/ui/calendar.tsx,
    components/ui/progress.tsx,
    components/ui/scroll-area.tsx
  </files>
  <read_first>
    - CLAUDE.md (stack constraints section — Next 16.2.6, React 19, shadcn v4 radix-nova/neutral, Tailwind v4, lucide-react)
    - AGENTS.md (Next 16 breaking-change warning)
    - .planning/phases/phase-kayinleong-01/01-PATTERNS.md "shadcn UI components" section (lines 99-135)
    - .planning/research/STACK.md (lines 49-72 — UI layer; lines 122-188 — domain libraries)
    - components.json (verify style: "radix-nova", baseColor: "neutral", cssVariables: true, iconLibrary: "lucide")
    - components/ui/button.tsx (canonical shape — confirm `import { Slot } from "radix-ui"` umbrella, not @radix-ui/react-slot)
    - package.json (existing deps: next 16.2.6, react 19.2.4, radix-ui 1.4.3, shadcn 4.8.0, lucide-react 1.16.0)
  </read_first>
  <action>
    Install Phase 1 runtime dependencies (single npm install command):

    ```bash
    npm install next-themes sonner @hookform/resolvers react-hook-form zod @tanstack/react-table date-fns @yudiel/react-qr-scanner bwip-js
    ```

    Pin versions per STACK.md:
    - `next-themes` — latest
    - `sonner` — latest (shadcn v4 recommended toaster)
    - `react-hook-form` ^7.x
    - `@hookform/resolvers` ^3.x (for the zodResolver)
    - `zod` ^4.x
    - `@tanstack/react-table` ^8.x
    - `date-fns` ^4.x
    - `@yudiel/react-qr-scanner` ^2.5.1 (per STACK.md confirmed version)
    - `bwip-js` ^4.10.x

    Then run the shadcn CLI to scaffold all 27 official registry components in a single batched command:

    ```bash
    npx shadcn@latest add input label textarea select checkbox radio-group switch form card badge table dialog alert-dialog sheet dropdown-menu tabs tooltip breadcrumb separator skeleton avatar sonner command popover calendar progress scroll-area --yes
    ```

    Critical:
    - DO NOT install individual `@radix-ui/react-*` packages (per STACK.md — shadcn v4 uses the consolidated `radix-ui` umbrella; already installed at ^1.4.3).
    - DO NOT paste-edit any installed file. If the CLI installs a component that imports `@radix-ui/react-foo`, run `npx shadcn@latest migrate radix` per STACK.md.
    - DO NOT install `table` and `data-table` separately — `data-table` is a "block" example, not a registry component. We compose it manually in later plans using `table` + `@tanstack/react-table`.
    - After install, verify `components/ui/sonner.tsx` exists (this is the Toaster wrapper imported in app/layout.tsx in Plan 03).
    - Do not yet wire `<Toaster />` into the root layout — that happens in Plan 03.

    If `next-themes` or `sonner` have peer dep warnings against React 19, accept the warnings — both libraries support React 19 per STACK.md.
  </action>
  <verify>
    <automated>npm install --dry-run 2>&1 | grep -q "would" || true; ls components/ui/input.tsx components/ui/form.tsx components/ui/sonner.tsx components/ui/command.tsx components/ui/calendar.tsx components/ui/data-table.tsx 2>&1 | grep -v "data-table.tsx: No such" | wc -l | grep -q "^5$"; grep -q "\"sonner\"" package.json; grep -q "\"zod\"" package.json; grep -q "\"@yudiel/react-qr-scanner\"" package.json; grep -q "\"bwip-js\"" package.json; grep -q "\"next-themes\"" package.json; grep -q "\"react-hook-form\"" package.json; grep -q "\"@tanstack/react-table\"" package.json; grep -q "\"date-fns\"" package.json; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "\"sonner\"" package.json` AND `grep -q "\"zod\"" package.json` AND `grep -q "\"@yudiel/react-qr-scanner\"" package.json` AND `grep -q "\"bwip-js\"" package.json` AND `grep -q "\"next-themes\"" package.json` AND `grep -q "\"react-hook-form\"" package.json` AND `grep -q "\"@hookform/resolvers\"" package.json` AND `grep -q "\"@tanstack/react-table\"" package.json` AND `grep -q "\"date-fns\"" package.json`.
    - All 27 files exist under `components/ui/`: input.tsx, label.tsx, textarea.tsx, select.tsx, checkbox.tsx, radio-group.tsx, switch.tsx, form.tsx, card.tsx, badge.tsx, table.tsx, dialog.tsx, alert-dialog.tsx, sheet.tsx, dropdown-menu.tsx, tabs.tsx, tooltip.tsx, breadcrumb.tsx, separator.tsx, skeleton.tsx, avatar.tsx, sonner.tsx, command.tsx, popover.tsx, calendar.tsx, progress.tsx, scroll-area.tsx. (Verify via `ls components/ui/*.tsx | wc -l` returns ≥28 — 27 new + button.tsx.)
    - No file imports `@radix-ui/react-*` (verify via `grep -r "@radix-ui/react-" components/ui/ | wc -l` returns 0).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>npm install completes successfully, 27 shadcn components installed via CLI, package.json contains 9 new runtime deps, no individual @radix-ui packages installed, tsc passes.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create entity types + Zod schemas mirroring ARCHITECTURE.md</name>
  <files>
    lib/types/item.ts,
    lib/types/event.ts,
    lib/types/user.ts,
    lib/types/transaction.ts,
    lib/types/missing-item.ts,
    lib/types/session.ts,
    lib/schemas/item.ts,
    lib/schemas/event.ts,
    lib/schemas/user.ts,
    lib/schemas/transaction.ts,
    lib/schemas/missing-item.ts,
    lib/schemas/auth.ts
  </files>
  <read_first>
    - .planning/research/ARCHITECTURE.md (Firestore Data Model section, lines 65-162 — every field name + type)
    - .planning/phases/phase-kayinleong-01/01-PATTERNS.md "Zod schema" section (lines 588-615) for the ItemSchema pattern; "Types" section (lines 137-145)
    - .planning/phases/phase-kayinleong-01/01-CONTEXT.md D-05 (lines 28-31 — mock cookie shape) and D-08 (sign-in flow)
    - .planning/REQUIREMENTS.md (INV-09 — lifecycle states; EVT-02 — event statuses; CI-04 — missing reasons; AUD-01 — actor snapshot fields)
    - .planning/research/STACK.md lines 146-158 (Zod 4 + form pattern)
  </read_first>
  <action>
    Create exactly 6 type files in `lib/types/` and 6 Zod schema files in `lib/schemas/`. Every field name, type, and union variant MUST mirror ARCHITECTURE.md exactly so Phase 2's Firestore swap is data-source-only.

    **lib/types/item.ts** (mirrors inventory/{itemId} in ARCHITECTURE.md):
    ```ts
    export type ItemLifecycleState = "available" | "checked_out" | "damaged" | "retired";
    export type ItemCategory = "Audio" | "Lighting" | "Display" | "Marketing";

    export type InventoryItem = {
      id: string;                       // doc id; equals SKU per PROJECT.md key decision #14
      name: string;
      sku: string;
      category: ItemCategory;
      totalQty: number;
      availableQty: number;
      outQty: number;
      damagedQty: number;               // tracked for `damaged` lifecycle state per INV-09
      unit: string;                     // "pcs" | "set" | etc.
      photoUrl: string | null;
      notes: string;
      lifecycleState: ItemLifecycleState;
      lowStockThreshold: number;        // RP-01
      lowStockOrderedAt: string | null; // RP-04
      createdAt: string;                // ISO; mock uses fixed 2026 dates per D-04
      updatedAt: string;
      createdBy: string;                // uid
      updatedBy: string;
    };
    ```

    **lib/types/event.ts** (mirrors events/{eventId}):
    ```ts
    export type EventStatus = "planned" | "active" | "completed" | "cancelled";

    export type EventDoc = {
      id: string;
      name: string;
      startDate: string;                // ISO
      endDate: string;
      status: EventStatus;
      location: string;
      description: string;
      teamLeads: string[];              // uids
      backupTeams: string[];            // uids
      allowedStaff: string[];           // denormalized union of teamLeads + backupTeams + admin uids
      plannedItems: Record<string, { plannedQty: number; notes: string }>;
      createdAt: string;
      createdBy: string;
      closedAt: string | null;
      closedBy: string | null;
    };
    ```

    **lib/types/user.ts** (mirrors users/{uid}):
    ```ts
    export type UserRole = "admin" | "staff";

    export type UserDoc = {
      uid: string;
      email: string;
      displayName: string;
      role: UserRole;
      disabled: boolean;
      createdAt: string;
      createdBy: string;
      lastLoginAt: string | null;
    };
    ```

    **lib/types/transaction.ts** (mirrors transactions/{txId}):
    ```ts
    export type TransactionType = "checkout" | "checkin" | "adjustment" | "missing";

    export type TransactionDoc = {
      id: string;
      type: TransactionType;
      itemId: string;
      itemSku: string;
      itemName: string;
      eventId: string | null;           // null for adjustment-only transactions
      eventName: string | null;
      qty: number;                      // always positive; sign implied by `type`
      actorUid: string;
      actorName: string;                // denormalized snapshot per AUD-01
      actorRoleAtTimeOfAction: UserRole; // denormalized snapshot per AUD-01
      at: string;                       // ISO; mock dates are 2026 fixed
      notes: string;
      parentTxId: string | null;        // CI-08 — links check-in to check-out
      clientTxId: string | null;
    };
    ```
    Import `UserRole` from `./user`.

    **lib/types/missing-item.ts** (mirrors missingItems/{missingId}):
    ```ts
    export type MissingReason = "Lost" | "Damaged" | "Not returned" | "Unknown";
    export type MissingStatus = "open" | "found" | "writtenOff";

    export type MissingItemDoc = {
      id: string;
      itemId: string;
      itemName: string;
      eventId: string;
      eventName: string;
      qty: number;
      reason: MissingReason;
      reportedBy: string;
      reportedByName: string;
      reportedAt: string;
      status: MissingStatus;
      resolvedAt: string | null;
      resolvedBy: string | null;
      parentCheckinTxId: string;
    };
    ```

    **lib/types/session.ts** (mirrors CONTEXT.md D-05):
    ```ts
    import type { UserRole } from "./user";

    export type Session = {
      uid: string;
      displayName: string;
      email: string;
      role: UserRole;
      disabled: boolean;
    };
    ```

    **lib/schemas/item.ts** (Zod 4 syntax, mirrors lib/types/item.ts):
    ```ts
    import { z } from "zod";

    export const ItemLifecycleStateEnum = z.enum(["available", "checked_out", "damaged", "retired"]);
    export const ItemCategoryEnum = z.enum(["Audio", "Lighting", "Display", "Marketing"]);

    export const ItemSchema = z.object({
      id: z.string().min(1),
      name: z.string().min(1, "Name is required."),
      sku: z.string().min(1, "SKU is required.").regex(/^[A-Z0-9-]+$/i, "Letters, digits, hyphens only."),
      category: ItemCategoryEnum,
      totalQty: z.number().int().nonnegative(),
      availableQty: z.number().int().nonnegative(),
      outQty: z.number().int().nonnegative(),
      damagedQty: z.number().int().nonnegative(),
      unit: z.string().min(1).default("pcs"),
      photoUrl: z.string().url().nullable(),
      notes: z.string().max(2000).default(""),
      lifecycleState: ItemLifecycleStateEnum,
      lowStockThreshold: z.number().int().nonnegative().default(0),
      lowStockOrderedAt: z.string().nullable(),
      createdAt: z.string(),
      updatedAt: z.string(),
      createdBy: z.string(),
      updatedBy: z.string(),
    }).refine(
      (v) => v.availableQty + v.outQty + v.damagedQty <= v.totalQty,
      { message: "available + out + damaged cannot exceed total.", path: ["availableQty"] }
    );

    // Form-input variant for /inventory/new and /inventory/[id]/edit (no audit fields)
    export const ItemFormSchema = z.object({
      name: z.string().min(1, "Name is required."),
      sku: z.string().min(1, "SKU is required.").regex(/^[A-Z0-9-]+$/i, "Letters, digits, hyphens only."),
      category: ItemCategoryEnum,
      totalQty: z.number().int().nonnegative(),
      unit: z.string().min(1).default("pcs"),
      photoUrl: z.string().url().nullable().or(z.literal("")),
      notes: z.string().max(2000).default(""),
      lowStockThreshold: z.number().int().nonnegative().default(0),
    });

    export type ItemInput = z.input<typeof ItemSchema>;
    export type ItemFormInput = z.input<typeof ItemFormSchema>;
    ```

    **lib/schemas/event.ts**:
    ```ts
    import { z } from "zod";

    export const EventStatusEnum = z.enum(["planned", "active", "completed", "cancelled"]);

    export const EventFormSchema = z.object({
      name: z.string().min(1, "Name is required."),
      startDate: z.string().min(1, "Start date is required."),
      endDate: z.string().min(1, "End date is required."),
      location: z.string().default(""),
      description: z.string().max(2000).default(""),
      teamLeads: z.array(z.string()).min(1, "At least one team lead is required."),
      backupTeams: z.array(z.string()).default([]),
    }).refine((v) => new Date(v.endDate) >= new Date(v.startDate), {
      message: "End date must be on or after start date.",
      path: ["endDate"],
    });

    export type EventFormInput = z.input<typeof EventFormSchema>;
    ```

    **lib/schemas/user.ts**:
    ```ts
    import { z } from "zod";

    export const UserRoleEnum = z.enum(["admin", "staff"]);

    export const InviteUserSchema = z.object({
      email: z.string().email("Enter a valid email."),
      displayName: z.string().min(1, "Display name is required."),
      role: UserRoleEnum,
    });

    export const SetUserRoleSchema = z.object({
      uid: z.string().min(1),
      role: UserRoleEnum,
    });

    export type InviteUserInput = z.input<typeof InviteUserSchema>;
    export type SetUserRoleInput = z.input<typeof SetUserRoleSchema>;
    ```

    **lib/schemas/transaction.ts** (used by mock store mutators for shape-checking):
    ```ts
    import { z } from "zod";

    export const TransactionTypeEnum = z.enum(["checkout", "checkin", "adjustment", "missing"]);

    export const CheckoutLineSchema = z.object({
      itemId: z.string().min(1),
      qty: z.number().int().positive(),
    });

    export const CheckoutCartSchema = z.object({
      eventId: z.string().min(1),
      lines: z.array(CheckoutLineSchema).min(1, "Add at least one item."),
    });

    export const CheckinLineSchema = z.object({
      parentTxId: z.string().min(1),
      itemId: z.string().min(1),
      returnedQty: z.number().int().nonnegative(),
      damagedQty: z.number().int().nonnegative().default(0),
      missingReason: z.enum(["Lost", "Damaged", "Not returned", "Unknown"]).optional(),
    }).refine(
      (v) => v.returnedQty > 0 || v.damagedQty > 0 || v.missingReason !== undefined,
      { message: "Must specify returned, damaged, or missing.", path: ["returnedQty"] }
    );

    export type CheckoutCartInput = z.input<typeof CheckoutCartSchema>;
    export type CheckinLineInput = z.input<typeof CheckinLineSchema>;
    ```

    **lib/schemas/missing-item.ts**:
    ```ts
    import { z } from "zod";

    export const MissingReasonEnum = z.enum(["Lost", "Damaged", "Not returned", "Unknown"]);
    export const MissingStatusEnum = z.enum(["open", "found", "writtenOff"]);

    export const ResolveMissingSchema = z.object({
      missingId: z.string().min(1),
      resolution: z.enum(["found", "writtenOff"]),
      notes: z.string().max(1000).default(""),
    });

    export type ResolveMissingInput = z.input<typeof ResolveMissingSchema>;
    ```

    **lib/schemas/auth.ts**:
    ```ts
    import { z } from "zod";

    export const LoginSchema = z.object({
      email: z.string().email("Enter a valid email."),
      password: z.string().min(1, "Password is required."),
    });

    export const ForgotPasswordSchema = z.object({
      email: z.string().email("Enter a valid email."),
    });

    export const SetPasswordSchema = z.object({
      password: z.string().min(8, "Use at least 8 characters."),
      confirmPassword: z.string().min(8),
    }).refine((v) => v.password === v.confirmPassword, {
      message: "Passwords do not match.",
      path: ["confirmPassword"],
    });

    export type LoginInput = z.input<typeof LoginSchema>;
    export type ForgotPasswordInput = z.input<typeof ForgotPasswordSchema>;
    export type SetPasswordInput = z.input<typeof SetPasswordSchema>;
    ```

    Critical:
    - Every type file is `.ts` (NOT `.tsx`) and exports types and nothing else (no runtime values except as noted in schema files).
    - Zod v4 is the major-version target (per STACK.md). If `z.enum([])` errors, ensure `package.json` shows `zod` `^4`.
    - Field names mirror ARCHITECTURE.md verbatim. Do NOT rename `availableQty` to `available`, etc.
    - Dates are stored as ISO strings in Phase 1 (mock data is fixed 2026 strings per D-04). Phase 2 will convert to Firestore Timestamps at the boundary.
    - The mock store will use `id` for items even though Firestore will use SKU as the doc id (PROJECT.md key decision #14). Phase 1 keeps both `id` and `sku` populated identically for simplicity.
  </action>
  <verify>
    <automated>ls lib/types/item.ts lib/types/event.ts lib/types/user.ts lib/types/transaction.ts lib/types/missing-item.ts lib/types/session.ts lib/schemas/item.ts lib/schemas/event.ts lib/schemas/user.ts lib/schemas/transaction.ts lib/schemas/missing-item.ts lib/schemas/auth.ts | wc -l | grep -q "^12$"; grep -q "ItemLifecycleState" lib/types/item.ts; grep -q "EventStatus" lib/types/event.ts; grep -q "actorRoleAtTimeOfAction" lib/types/transaction.ts; grep -q "allowedStaff" lib/types/event.ts; grep -q "parentTxId" lib/types/transaction.ts; grep -q "parentCheckinTxId" lib/types/missing-item.ts; grep -q "ItemSchema" lib/schemas/item.ts; grep -q "z.object" lib/schemas/item.ts; grep -q "LoginSchema" lib/schemas/auth.ts; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - All 12 files exist (verify via `ls lib/types/*.ts lib/schemas/*.ts | wc -l` returns ≥12).
    - `grep -q "ItemLifecycleState" lib/types/item.ts` AND `grep -q "EventStatus" lib/types/event.ts` AND `grep -q "MissingReason" lib/types/missing-item.ts` AND `grep -q "TransactionType" lib/types/transaction.ts` AND `grep -q "Session" lib/types/session.ts`.
    - Every type file imports `UserRole` from `./user` where it references it (no duplicate definitions).
    - Field-name parity verified: `grep -q "actorRoleAtTimeOfAction" lib/types/transaction.ts` AND `grep -q "allowedStaff" lib/types/event.ts` AND `grep -q "parentTxId" lib/types/transaction.ts`.
    - Every schema file exports its `*Input` inferred type.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>12 files exist, types mirror ARCHITECTURE.md exactly, schemas use Zod 4 syntax, tsc passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| package.json → npm registry | Untrusted code execution risk if a typo-squat or compromised package is installed |
| Zod schemas as input validators | Schemas guard Phase 2's Server Actions (which Phase 1 stubs as mock-store mutators). Bad schemas → undefined behavior in Phase 2. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Tampering | npm install of new deps | mitigate | Pin to versions specified in STACK.md; only install packages explicitly listed (no transitive add-ons). |
| T-01-02 | Information disclosure | Zod schemas accidentally permitting unknown fields that pass through to mocks | mitigate | All schemas use closed `z.object({...})` — Zod 4's default is `strip` (unknown fields removed). No `.passthrough()` calls. |
| T-01-03 | Spoofing | Mismatch between lib/types and lib/schemas creates two sources of truth | accept | Trade-off: schemas use `z.input` vs entity types include audit fields like createdAt. Both must coexist (form inputs vs full docs). Mitigate via Plan 13 typecheck. |

Phase 1 specific: no real auth surface yet. These threats document the deliberate position that mock infrastructure mirrors Phase 2 contracts so the swap is transparent.
</threat_model>

<verification>
- `npm install` completes successfully with no errors (peer-dep warnings on React 19 are acceptable per STACK.md).
- All 27 shadcn UI files exist, none imported from `@radix-ui/react-*` individual packages.
- All 6 type files + 6 schema files exist.
- `npx tsc --noEmit` exits 0 — types compile without errors.
- No file in lib/types or lib/schemas references a Firebase symbol (no `firebase/*` imports; this is Phase 2's job).
</verification>

<success_criteria>
- Foundation deps installed (9 new packages + 27 shadcn components scaffolded via CLI).
- 12 contract files (6 types + 6 schemas) committed.
- tsc passes against the new types + schemas.
- NFR-01, NFR-02, NFR-03, NFR-04, NFR-09 satisfied at the dep-baseline level.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-01/01-01-stack-types-schemas-SUMMARY.md` with:
- All 27 shadcn CLI-installed components listed
- 9 new npm dep names + installed versions
- Confirmation that all 12 type/schema files exist and tsc passes
- Any peer-dep warnings observed and the explicit decision to accept them
</output>
