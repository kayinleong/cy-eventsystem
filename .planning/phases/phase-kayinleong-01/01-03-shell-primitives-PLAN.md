---
phase: 01-ui-poc
plan: 03
type: execute
wave: 1
depends_on: [01]
files_modified:
  - app/layout.tsx
  - app/globals.css
  - components/ui/theme-provider.tsx
  - components/ui/theme-toggle.tsx
  - components/ui/empty-state.tsx
  - components/ui/page-header.tsx
  - components/feature/status/StatusBadge.tsx
  - components/feature/status/status-to-tone.ts
  - components/feature/inventory/QtyStepper.tsx
  - lib/hooks/use-debounced-value.ts
  - lib/hooks/use-url-table-state.ts
  - components/feature/table/DataTablePagination.tsx
  - components/feature/table/DataTableToolbar.tsx
  - components/feature/table/DataTableViewOptions.tsx
  - components/feature/table/DataTable.tsx
autonomous: true
requirements:
  - NFR-01
  - NFR-05
  - REP-06
  - REP-07
  - CO-07
  - SCN-02

must_haves:
  truths:
    - "Root layout wires ThemeProvider (next-themes, attribute=class, defaultTheme=system) + Sonner Toaster + Geist fonts + min-h-svh body."
    - "Theme toggle component lets the user pick Light/Dark/System and persists via next-themes."
    - "StatusBadge component renders outline + colored dot variants per UI-SPEC status palette (green/blue/amber/muted/destructive)."
    - "QtyStepper meets 44px touch-target accessibility floor per UI-SPEC."
    - "Generic DataTable wrapper provides URL-synced pagination, sort, filter, and column-visibility — reused by every list page in Wave 3."
    - "lib/hooks/use-url-table-state.ts and lib/hooks/use-debounced-value.ts live in this plan (owned alongside their DataTable + DataTableToolbar consumers) — D-09/D-10/D-11/D-12 contracts are entirely satisfied here."
    - "D-11 selective sort rule is enforced in the DataTable column-definition contract: only name/SKU, qty/availableQty, date/startDate/endDate/serverTimestamp, and status/lifecycle render sort affordances. Actor display name, notes, and reason text MUST NOT call toggleSorting."
    - "EmptyState and PageHeader components match UI-SPEC visual and copy contracts verbatim."
  artifacts:
    - path: "app/layout.tsx"
      provides: "Root layout with ThemeProvider + Toaster, metadata updated"
      contains: "ThemeProvider"
    - path: "components/ui/theme-provider.tsx"
      provides: "'use client' wrapper around next-themes ThemeProvider so root layout stays a Server Component"
      contains: "'use client'"
    - path: "components/ui/theme-toggle.tsx"
      provides: "Sun/Moon/Monitor dropdown for theme selection"
      contains: "useTheme"
    - path: "components/feature/status/StatusBadge.tsx"
      provides: "cva-based StatusBadge with 5 tone variants"
      contains: "cva"
    - path: "components/feature/inventory/QtyStepper.tsx"
      provides: "44px touch-target +/- stepper with min/max bounds"
      contains: "QtyStepper"
    - path: "lib/hooks/use-debounced-value.ts"
      provides: "useDebouncedValue<T>(value, delay=250) — consumed by DataTableToolbar per D-12"
      contains: "useDebouncedValue"
    - path: "lib/hooks/use-url-table-state.ts"
      provides: "useUrlTableState(filterKeys) — URL-synced page/q/sort/filters per D-09/D-10/D-11/D-12; consumed by DataTable"
      contains: "useUrlTableState"
    - path: "components/feature/table/DataTable.tsx"
      provides: "Generic TanStack v8 + shadcn table wrapper consuming useUrlTableState"
      contains: "useReactTable"
      min_lines: 100
  key_links:
    - from: "app/layout.tsx"
      to: "components/ui/theme-provider.tsx + components/ui/sonner.tsx"
      via: "ThemeProvider wraps children, Toaster rendered inside"
      pattern: "ThemeProvider"
    - from: "components/feature/table/DataTable.tsx"
      to: "lib/hooks/use-url-table-state.ts"
      via: "DataTable consumes useUrlTableState for pagination/sort/filter URL sync"
      pattern: "useUrlTableState"
    - from: "components/feature/status/StatusBadge.tsx"
      to: "components/feature/status/status-to-tone.ts"
      via: "StatusBadge accepts a tone prop; status-to-tone.ts maps domain statuses to tone variants"
      pattern: "statusToTone"
---

<objective>
Build the shared UI primitives every Wave 2+ plan depends on: theme provider, theme toggle, status badge, qty stepper, empty state, page header, generic data-table wrapper with URL sync. Modify the root `app/layout.tsx` to wire ThemeProvider + Toaster.

Purpose: Centralize visual contracts (UI-SPEC) and behavior contracts (URL-synced tables, status mapping, accessibility floor) so feature plans in Wave 3 are thin composition layers.

Output: 1 modified root layout, 14 new files (3 ui/ + 9 feature/ across status, inventory, table dirs + 2 lib/hooks/ colocated with their DataTable consumers).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@CLAUDE.md
@AGENTS.md
@.planning/phases/phase-kayinleong-01/01-CONTEXT.md
@.planning/phases/phase-kayinleong-01/01-UI-SPEC.md
@.planning/phases/phase-kayinleong-01/01-PATTERNS.md
@.planning/research/PITFALLS.md
@app/layout.tsx
@app/globals.css
@components/ui/button.tsx
@components/ui/sonner.tsx
@components/ui/dropdown-menu.tsx
@components/ui/input.tsx
@components/ui/badge.tsx
@components/ui/table.tsx
@lib/utils.ts
@lib/types/item.ts
@lib/types/event.ts
@lib/types/missing-item.ts
@lib/types/transaction.ts
@lib/hooks/use-url-table-state.ts
@lib/hooks/use-debounced-value.ts

<interfaces>
<!-- Primitives interface contract — Wave 3 plans will consume these by name. Do not rename. -->

```ts
// components/ui/theme-provider.tsx
export function ThemeProvider(props: { children: React.ReactNode; attribute?: string; defaultTheme?: string; enableSystem?: boolean }): React.ReactElement;

// components/ui/theme-toggle.tsx
export function ThemeToggle(): React.ReactElement;

// components/ui/empty-state.tsx
export function EmptyState(props: { icon: LucideIcon; heading: string; body: string; action?: React.ReactNode }): React.ReactElement;

// components/ui/page-header.tsx
export function PageHeader(props: { title: string; description?: string; action?: React.ReactNode }): React.ReactElement;

// components/feature/status/StatusBadge.tsx
export type StatusTone = "green" | "blue" | "amber" | "muted" | "destructive";
export function StatusBadge(props: { tone: StatusTone; children: React.ReactNode; className?: string }): React.ReactElement;

// components/feature/status/status-to-tone.ts
export function statusToTone(status: string): StatusTone; // maps every domain status string to a tone

// components/feature/inventory/QtyStepper.tsx
export function QtyStepper(props: { value: number; onChange: (v: number) => void; min?: number; max?: number; disabled?: boolean }): React.ReactElement;

// lib/hooks/use-debounced-value.ts
export function useDebouncedValue<T>(value: T, delay?: number): T; // default 250ms per D-12

// lib/hooks/use-url-table-state.ts
export type UrlTableState = { page: number; q: string; sort: string; filters: Record<string, string> };
export function useUrlTableState(filterKeys?: string[]): {
  state: UrlTableState;
  setPage: (p: number) => void;
  setGlobalFilter: (q: string) => void;
  setSort: (sort: string) => void;        // D-11: only call for whitelisted columns
  setFilter: (key: string, value: string | undefined) => void;
};

// components/feature/table/DataTable.tsx
export function DataTable<T>(props: {
  columns: ColumnDef<T>[];
  data: T[];
  filterKeys?: string[];      // URL filter param keys this table syncs
  globalFilterPlaceholder?: string;
  pageSize?: number;          // default 50 per REP-07
  emptyState?: React.ReactNode;
}): React.ReactElement;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire root layout + create theme provider + theme toggle + EmptyState + PageHeader</name>
  <files>
    app/layout.tsx,
    components/ui/theme-provider.tsx,
    components/ui/theme-toggle.tsx,
    components/ui/empty-state.tsx,
    components/ui/page-header.tsx
  </files>
  <read_first>
    - app/layout.tsx (existing — preserves Geist fonts + html/body)
    - components/ui/sonner.tsx (CLI-installed in Plan 01)
    - components/ui/dropdown-menu.tsx (CLI-installed in Plan 01)
    - components/ui/button.tsx (canonical cva shape)
    - .planning/phases/phase-kayinleong-01/01-PATTERNS.md sections "Root layout" (lines 193-224), "Theme toggle" (lines 824-853), "Empty state" (lines 992-1023), "Page header" (lines 1027-1052)
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md "Empty-state copy (Q8)" table (line 207-218), Typography table (Heading-M 18px / 600)
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md (root layout doc)
    - .planning/research/PITFALLS.md "Theme variable mismatches" (lines 207-212)
  </read_first>
  <action>
    **components/ui/theme-provider.tsx** (Client Component wrapper so the root layout stays a Server Component):
    ```tsx
    "use client";
    import { ThemeProvider as NextThemesProvider } from "next-themes";
    import type * as React from "react";

    export function ThemeProvider({
      children,
      ...props
    }: React.ComponentProps<typeof NextThemesProvider>) {
      return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
    }
    ```

    **components/ui/theme-toggle.tsx** (Sun/Moon/Monitor dropdown):
    ```tsx
    "use client";
    import { Moon, Sun, Monitor } from "lucide-react";
    import { useTheme } from "next-themes";
    import {
      DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
    } from "@/components/ui/dropdown-menu";
    import { Button } from "@/components/ui/button";

    export function ThemeToggle() {
      const { setTheme } = useTheme();
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Toggle theme">
              <Sun className="size-4 dark:hidden" />
              <Moon className="size-4 hidden dark:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 size-4" /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 size-4" /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 size-4" /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    ```

    **components/ui/empty-state.tsx** (UI-SPEC empty-state visual contract — centered vertical, py-16, lucide icon size-6 muted-foreground, 18px heading, 14px body):
    ```tsx
    import type { LucideIcon } from "lucide-react";

    export function EmptyState({
      icon: Icon,
      heading,
      body,
      action,
    }: {
      icon: LucideIcon;
      heading: string;
      body: string;
      action?: React.ReactNode;
    }) {
      return (
        <div className="flex flex-col items-center text-center py-16 gap-3">
          <Icon className="size-6 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{heading}</h2>
          <p className="text-sm text-muted-foreground max-w-sm">{body}</p>
          {action ? <div className="mt-2">{action}</div> : null}
        </div>
      );
    }
    ```

    **components/ui/page-header.tsx** (UI-SPEC Heading-M 18px / 600 + optional description + action slot):
    ```tsx
    export function PageHeader({
      title,
      description,
      action,
    }: {
      title: string;
      description?: string;
      action?: React.ReactNode;
    }) {
      return (
        <div className="flex items-start justify-between gap-4 pb-6 border-b mb-6">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {description ? <p className="text-sm text-muted-foreground mt-1">{description}</p> : null}
          </div>
          {action}
        </div>
      );
    }
    ```

    **app/layout.tsx** (modify existing — preserve Geist setup, add ThemeProvider + Toaster, update metadata):
    ```tsx
    import type { Metadata } from "next";
    import { Geist, Geist_Mono } from "next/font/google";
    import { ThemeProvider } from "@/components/ui/theme-provider";
    import { Toaster } from "@/components/ui/sonner";
    import "./globals.css";

    const geistSans = Geist({
      variable: "--font-geist-sans",
      subsets: ["latin"],
    });

    const geistMono = Geist_Mono({
      variable: "--font-geist-mono",
      subsets: ["latin"],
    });

    export const metadata: Metadata = {
      title: { default: "cy-eventsystem", template: "%s · cy-eventsystem" },
      description: "Event-based physical inventory tracking",
    };

    export default function RootLayout({
      children,
    }: Readonly<{
      children: React.ReactNode;
    }>) {
      return (
        <html
          lang="en"
          className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
          suppressHydrationWarning
        >
          <body className="min-h-svh bg-background text-foreground">
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              {children}
              <Toaster richColors closeButton />
            </ThemeProvider>
          </body>
        </html>
      );
    }
    ```

    Critical:
    - `suppressHydrationWarning` on `<html>` is required by next-themes per its README (server renders without class, client hydrates with `light`/`dark`).
    - `min-h-svh` (small viewport height) is the modern viewport unit; mobile-safe.
    - DO NOT change `globals.css` — UI-SPEC confirms 19 tokens already present at `:root` and `.dark`.
    - DO NOT add `'use client'` to `app/layout.tsx`. The directive belongs only on `theme-provider.tsx`.
  </action>
  <verify>
    <automated>grep -q "ThemeProvider" app/layout.tsx; grep -q "from \"@/components/ui/sonner\"" app/layout.tsx; grep -q "Toaster" app/layout.tsx; grep -q "suppressHydrationWarning" app/layout.tsx; grep -q "min-h-svh" app/layout.tsx; ls components/ui/theme-provider.tsx components/ui/theme-toggle.tsx components/ui/empty-state.tsx components/ui/page-header.tsx | wc -l | grep -q "^4$"; grep -q "'use client'" components/ui/theme-provider.tsx; grep -q "useTheme" components/ui/theme-toggle.tsx; grep -q "py-16" components/ui/empty-state.tsx; grep -q "text-lg font-semibold" components/ui/page-header.tsx; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `app/layout.tsx` imports `ThemeProvider` from `@/components/ui/theme-provider` AND `Toaster` from `@/components/ui/sonner`.
    - `app/layout.tsx` includes `suppressHydrationWarning` attribute on `<html>` (required by next-themes).
    - `app/layout.tsx` body element uses `min-h-svh` Tailwind class.
    - All 4 new files exist: `components/ui/theme-provider.tsx`, `components/ui/theme-toggle.tsx`, `components/ui/empty-state.tsx`, `components/ui/page-header.tsx`.
    - `components/ui/theme-provider.tsx` starts with `'use client'` directive.
    - `components/ui/theme-toggle.tsx` calls `useTheme` from next-themes.
    - `components/ui/empty-state.tsx` includes `py-16` class (matches UI-SPEC vertical padding).
    - `components/ui/page-header.tsx` uses `text-lg font-semibold` for the title (matches UI-SPEC Heading-M).
    - `npx tsc --noEmit` exits 0.
    - `npm run build` exits 0 (root layout compiles).
  </acceptance_criteria>
  <done>Root layout wires theme + sonner; 4 primitive files exist; theme toggle uses lucide Sun/Moon/Monitor; tsc + build pass.</done>
</task>

<task type="auto">
  <name>Task 2: Create StatusBadge + statusToTone + QtyStepper + DataTable wrappers</name>
  <files>
    components/feature/status/StatusBadge.tsx,
    components/feature/status/status-to-tone.ts,
    components/feature/inventory/QtyStepper.tsx,
    lib/hooks/use-debounced-value.ts,
    lib/hooks/use-url-table-state.ts,
    components/feature/table/DataTable.tsx,
    components/feature/table/DataTableToolbar.tsx,
    components/feature/table/DataTablePagination.tsx,
    components/feature/table/DataTableViewOptions.tsx
  </files>
  <read_first>
    - components/ui/button.tsx (cva pattern — StatusBadge mirrors this shape per PATTERNS.md "Status badge" lines 780-819)
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md "Status Palette (Q4)" table (lines 111-122) — exact tone-to-tailwind mapping
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md "Density" + "Exceptions" sections (lines 56-67) — 44px touch-target rule
    - .planning/phases/phase-kayinleong-01/01-PATTERNS.md sections "TanStack data-table" (lines 618-688) and "Shared #5 — URL state" (lines 1127-1132) and "Shared #10 — Status enum → tone mapping" (lines 1188-1204)
    - lib/hooks/use-url-table-state.ts (CREATED IN THIS TASK below — DataTable is the primary consumer)
    - lib/hooks/use-debounced-value.ts (CREATED IN THIS TASK below — DataTableToolbar is the primary consumer)
    - .planning/phases/phase-kayinleong-01/01-CONTEXT.md D-09 / D-10 / D-11 / D-12 (URL state contracts these two hooks implement)
    - components/ui/table.tsx (CLI-installed)
    - components/ui/input.tsx (CLI-installed)
    - components/ui/dropdown-menu.tsx (CLI-installed)
    - .planning/REQUIREMENTS.md REP-06 (URL params), REP-07 (50/page default), CO-07 (debounced scan), SCN-02 (rear camera default — informs no scanner here)
  </read_first>
  <action>
    **components/feature/status/StatusBadge.tsx** (cva — mirror button.tsx shape):
    ```tsx
    import { cva, type VariantProps } from "class-variance-authority";
    import { cn } from "@/lib/utils";

    const statusBadgeVariants = cva(
      "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium",
      {
        variants: {
          tone: {
            green:       "[&_[data-dot]]:bg-green-500 dark:[&_[data-dot]]:bg-green-400",
            blue:        "[&_[data-dot]]:bg-blue-500 dark:[&_[data-dot]]:bg-blue-400",
            amber:       "[&_[data-dot]]:bg-amber-500 dark:[&_[data-dot]]:bg-amber-400",
            muted:       "[&_[data-dot]]:bg-muted-foreground",
            destructive: "[&_[data-dot]]:bg-destructive",
          },
        },
        defaultVariants: { tone: "muted" },
      }
    );

    export type StatusTone = NonNullable<VariantProps<typeof statusBadgeVariants>["tone"]>;

    export function StatusBadge({
      tone,
      children,
      className,
    }: VariantProps<typeof statusBadgeVariants> & { children: React.ReactNode; className?: string }) {
      return (
        <span className={cn(statusBadgeVariants({ tone, className }))}>
          <span data-dot className="size-1.5 rounded-full inline-block" />
          {children}
        </span>
      );
    }

    export { statusBadgeVariants };
    ```

    **components/feature/status/status-to-tone.ts** (UI-SPEC Status Palette mapping, exhaustive):
    ```ts
    import type { StatusTone } from "./StatusBadge";

    export type DomainStatus =
      // item lifecycle
      | "available" | "checked_out" | "damaged" | "retired"
      // event status
      | "planned" | "active" | "completed" | "cancelled"
      // missing status
      | "open" | "found" | "writtenOff" | "missing"
      // computed dashboard states
      | "low-stock" | "overdue"
      // transaction types
      | "checkout" | "checkin" | "adjustment";

    export function statusToTone(status: string): StatusTone {
      // UI-SPEC "Status Palette (Q4)" — locked
      if (status === "available" || status === "planned" || status === "active") return "green";
      if (status === "checked_out" || status === "in-progress" || status === "checkout") return "blue";
      if (status === "damaged" || status === "low-stock" || status === "overdue") return "amber";
      if (status === "retired" || status === "completed" || status === "cancelled" || status === "found" || status === "writtenOff" || status === "checkin" || status === "adjustment") return "muted";
      if (status === "missing" || status === "open") return "destructive";
      return "muted";
    }

    // Convenience: human-readable label for the same enum (sentence-case per UI-SPEC).
    export function statusToLabel(status: string): string {
      switch (status) {
        case "available": return "Available";
        case "checked_out": return "Checked out";
        case "damaged": return "Damaged";
        case "retired": return "Retired";
        case "planned": return "Planned";
        case "active": return "Active";
        case "completed": return "Completed";
        case "cancelled": return "Cancelled";
        case "open": return "Open";
        case "found": return "Found";
        case "writtenOff": return "Written off";
        case "missing": return "Missing";
        case "low-stock": return "Low stock";
        case "overdue": return "Overdue";
        case "checkout": return "Check-out";
        case "checkin": return "Check-in";
        case "adjustment": return "Adjustment";
        default: return status;
      }
    }
    ```

    Note about `selectOpenMissing` from selectors: the status field on a missing record can be "open" — that's destructive tone. But on a status badge displaying an OPEN missing item we want "amber" (it's a problem but not the destructive verb). Wait — UI-SPEC says `missing` is destructive (red). So when the open MissingItem row badge needs to say "Open" we use destructive tone. This is intentional per UI-SPEC. Executor: follow the mapping above exactly; do not second-guess.

    **components/feature/inventory/QtyStepper.tsx** (44px touch-target per UI-SPEC):
    ```tsx
    "use client";
    import { Minus, Plus } from "lucide-react";
    import { Button } from "@/components/ui/button";
    import { Input } from "@/components/ui/input";
    import { cn } from "@/lib/utils";

    export function QtyStepper({
      value,
      onChange,
      min = 0,
      max = Number.MAX_SAFE_INTEGER,
      disabled = false,
      className,
    }: {
      value: number;
      onChange: (v: number) => void;
      min?: number;
      max?: number;
      disabled?: boolean;
      className?: string;
    }) {
      const clamp = (n: number) => Math.max(min, Math.min(max, Math.floor(n)));
      return (
        <div className={cn("inline-flex items-center gap-1", className)}>
          <Button
            type="button"
            variant="outline"
            // 44px touch target — UI-SPEC accessibility floor exception
            className="size-11 p-0"
            onClick={() => onChange(clamp(value - 1))}
            disabled={disabled || value <= min}
            aria-label="Decrease quantity"
          >
            <Minus className="size-4" />
          </Button>
          <Input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-16 text-center font-mono"
            value={value}
            min={min}
            max={max}
            disabled={disabled}
            onChange={(e) => onChange(clamp(Number(e.target.value || 0)))}
            aria-label="Quantity"
          />
          <Button
            type="button"
            variant="outline"
            className="size-11 p-0"
            onClick={() => onChange(clamp(value + 1))}
            disabled={disabled || value >= max}
            aria-label="Increase quantity"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      );
    }
    ```

    **lib/hooks/use-debounced-value.ts** (used by DataTableToolbar at 250ms per D-12):
    ```tsx
    "use client";
    import { useEffect, useState } from "react";

    export function useDebouncedValue<T>(value: T, delay = 250): T {
      const [debounced, setDebounced] = useState(value);
      useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
      }, [value, delay]);
      return debounced;
    }
    ```

    **lib/hooks/use-url-table-state.ts** (D-09/D-10/D-11/D-12 URL-table state sync — consumed by DataTable):
    ```tsx
    "use client";
    import { useRouter, useSearchParams, usePathname } from "next/navigation";
    import { useCallback, useMemo } from "react";

    export type UrlTableState = {
      page: number;        // 1-based for URL; 0-based for TanStack
      q: string;
      sort: string;        // e.g., "name:asc" or empty — D-11 column whitelist enforced by consumers
      filters: Record<string, string>;
    };

    export function useUrlTableState(filterKeys: string[] = []): {
      state: UrlTableState;
      setPage: (p: number) => void;
      setGlobalFilter: (q: string) => void;
      setSort: (sort: string) => void;
      setFilter: (key: string, value: string | undefined) => void;
    } {
      const router = useRouter();
      const pathname = usePathname();
      const searchParams = useSearchParams();

      const state = useMemo<UrlTableState>(() => {
        const filters: Record<string, string> = {};
        for (const key of filterKeys) {
          const v = searchParams.get(key);
          if (v) filters[key] = v;
        }
        return {
          page: Math.max(1, Number(searchParams.get("page") ?? "1")),
          q: searchParams.get("q") ?? "",
          sort: searchParams.get("sort") ?? "",
          filters,
        };
      }, [searchParams, filterKeys]);

      const push = useCallback((updater: (next: URLSearchParams) => void) => {
        const next = new URLSearchParams(Array.from(searchParams.entries()));
        updater(next);
        router.replace(`${pathname}?${next.toString()}`, { scroll: false }); // D-09
      }, [router, pathname, searchParams]);

      const setPage = useCallback((p: number) => push((n) => {
        if (p <= 1) n.delete("page"); else n.set("page", String(p));
      }), [push]);
      const setGlobalFilter = useCallback((q: string) => push((n) => {
        if (!q) n.delete("q"); else n.set("q", q);
        n.delete("page");
      }), [push]);
      const setSort = useCallback((sort: string) => push((n) => {
        if (!sort) n.delete("sort"); else n.set("sort", sort);
      }), [push]);
      const setFilter = useCallback((key: string, value: string | undefined) => push((n) => {
        if (!value) n.delete(key); else n.set(key, value);
        n.delete("page");
      }), [push]);

      return { state, setPage, setGlobalFilter, setSort, setFilter };
    }
    ```

    Critical for both hooks: they live in `lib/hooks/` (NOT `lib/mock/`) because they are pure client-side primitives — no dependency on mock store, reusable verbatim in Phase 2.

    **components/feature/table/DataTableToolbar.tsx** (global filter input + slot for custom filters):
    ```tsx
    "use client";
    import { useEffect, useState } from "react";
    import { Input } from "@/components/ui/input";
    import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

    export function DataTableToolbar({
      globalFilter,
      onGlobalFilterChange,
      placeholder = "Search…",
      children,
    }: {
      globalFilter: string;
      onGlobalFilterChange: (v: string) => void;
      placeholder?: string;
      children?: React.ReactNode;
    }) {
      const [local, setLocal] = useState(globalFilter);
      const debounced = useDebouncedValue(local, 250); // D-12

      useEffect(() => { setLocal(globalFilter); }, [globalFilter]);
      useEffect(() => {
        if (debounced !== globalFilter) onGlobalFilterChange(debounced);
      }, [debounced, globalFilter, onGlobalFilterChange]);

      return (
        <div className="flex items-center gap-2 pb-3">
          <Input
            placeholder={placeholder}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className="max-w-xs"
          />
          {children}
        </div>
      );
    }
    ```

    **components/feature/table/DataTablePagination.tsx** (REP-07 default 50, "Page N of M" chrome per D-10):
    ```tsx
    "use client";
    import { ChevronLeft, ChevronRight } from "lucide-react";
    import { Button } from "@/components/ui/button";
    import type { Table } from "@tanstack/react-table";

    export function DataTablePagination<T>({
      table,
      onPageChange,
    }: {
      table: Table<T>;
      onPageChange: (page1Based: number) => void;
    }) {
      const pageIndex = table.getState().pagination.pageIndex;
      const pageCount = table.getPageCount() || 1;
      const totalRows = table.getFilteredRowModel().rows.length;

      return (
        <div className="flex items-center justify-between gap-4 pt-4 border-t mt-4">
          <p className="text-sm text-muted-foreground">
            Page {pageIndex + 1} of {pageCount} · {totalRows} rows
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pageIndex)}
              disabled={pageIndex === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pageIndex + 2)}
              disabled={pageIndex + 1 >= pageCount}
              aria-label="Next page"
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      );
    }
    ```

    **components/feature/table/DataTableViewOptions.tsx** (column visibility per UI-SPEC):
    ```tsx
    "use client";
    import { Settings2 } from "lucide-react";
    import {
      DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
      DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
    } from "@/components/ui/dropdown-menu";
    import { Button } from "@/components/ui/button";
    import type { Table } from "@tanstack/react-table";

    export function DataTableViewOptions<T>({ table }: { table: Table<T> }) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto">
              <Settings2 className="mr-2 size-4" /> Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table.getAllColumns().filter((c) => c.getCanHide()).map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
                className="capitalize"
              >
                {column.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    ```

    **components/feature/table/DataTable.tsx** (generic wrapper — combines TanStack v8 + URL sync + the three sub-components):
    ```tsx
    "use client";
    import { useMemo, useState } from "react";
    import {
      useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
      getSortedRowModel, flexRender,
      type ColumnDef, type SortingState, type VisibilityState,
    } from "@tanstack/react-table";
    import {
      Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
    } from "@/components/ui/table";
    import { DataTableToolbar } from "./DataTableToolbar";
    import { DataTablePagination } from "./DataTablePagination";
    import { DataTableViewOptions } from "./DataTableViewOptions";
    import { useUrlTableState } from "@/lib/hooks/use-url-table-state";

    export type DataTableProps<T> = {
      columns: ColumnDef<T>[];
      data: T[];
      filterKeys?: string[];
      globalFilterPlaceholder?: string;
      pageSize?: number;
      emptyState?: React.ReactNode;
      enableColumnVisibility?: boolean;
      toolbarExtras?: React.ReactNode;
    };

    export function DataTable<T>({
      columns,
      data,
      filterKeys = [],
      globalFilterPlaceholder,
      pageSize = 50, // REP-07
      emptyState = null,
      enableColumnVisibility = true,
      toolbarExtras,
    }: DataTableProps<T>) {
      const { state: url, setPage, setGlobalFilter, setSort } = useUrlTableState(filterKeys);

      const sorting: SortingState = useMemo(() => {
        if (!url.sort) return [];
        const [id, dir] = url.sort.split(":");
        return id ? [{ id, desc: dir === "desc" }] : [];
      }, [url.sort]);

      const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

      const table = useReactTable({
        data,
        columns,
        state: {
          sorting,
          globalFilter: url.q,
          pagination: { pageIndex: url.page - 1, pageSize },
          columnVisibility,
        },
        onSortingChange: (updater) => {
          const next = typeof updater === "function" ? updater(sorting) : updater;
          const first = next[0];
          setSort(first ? `${first.id}:${first.desc ? "desc" : "asc"}` : "");
        },
        onGlobalFilterChange: (q: string) => setGlobalFilter(q),
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        manualPagination: false,
      });

      const rows = table.getRowModel().rows;
      const isEmpty = data.length === 0;

      return (
        <div>
          <div className="flex items-center gap-2 pb-3">
            <DataTableToolbar
              globalFilter={url.q}
              onGlobalFilterChange={setGlobalFilter}
              placeholder={globalFilterPlaceholder ?? "Search…"}
            >
              {toolbarExtras}
            </DataTableToolbar>
            {enableColumnVisibility && <DataTableViewOptions table={table} />}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id}>
                    {group.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isEmpty ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="p-0">
                      {emptyState}
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                      No results.
                    </TableCell>
                  </TableRow>
                ) : rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination table={table} onPageChange={setPage} />
        </div>
      );
    }
    ```

    **D-11 sortable columns rule (LOCKED — quoted verbatim from CONTEXT.md D-11):**
    > "Selective sortable columns: name/SKU (inventory + items-out), qty / availableQty (inventory + reports), date / startDate / endDate / serverTimestamp (events + history + missing), status / lifecycle (inventory + events). Sort UI is the TanStack `column.toggleSorting()` arrow button on headers. Columns without sort (actor display name, notes, reason text) don't render a sort affordance."

    Every plan that defines `ColumnDef<T>[]` for DataTable (Plan 06 inventory, Plan 07 events, Plan 10 checkin missing-items lines, Plan 11 reports) MUST honour this rule:
    - ✅ Sortable columns: name, SKU, qty, availableQty, date, startDate, endDate, serverTimestamp/at, status, lifecycleState. These render a header `<Button>...<ArrowUpDown/></Button>` that calls `column.toggleSorting()`.
    - ❌ Non-sortable columns: actor display name / actorName, notes, reason text, photoUrl, descriptions. These render plain text headers (string) — NO toggleSorting, NO ArrowUpDown icon.
    - Consumers (06/07/10/11) carry a one-line `// D-11: <col> is NOT sortable` comment on every excluded column so reviewers can audit at a glance.

    Critical:
    - All 4 table files are `'use client'`.
    - Default `pageSize: 50` matches REP-07.
    - URL params drive table state per D-09/D-10/D-11/D-12.
    - Pagination chrome ALWAYS renders (D-10).
    - D-11 selective-sort rule (above) is the contract the DataTable consumers in Plans 06, 07, 10, and 11 must honour.
  </action>
  <verify>
    <automated>ls components/feature/status/StatusBadge.tsx components/feature/status/status-to-tone.ts components/feature/inventory/QtyStepper.tsx lib/hooks/use-debounced-value.ts lib/hooks/use-url-table-state.ts components/feature/table/DataTable.tsx components/feature/table/DataTableToolbar.tsx components/feature/table/DataTablePagination.tsx components/feature/table/DataTableViewOptions.tsx | wc -l | grep -q "^9$"; grep -q "cva" components/feature/status/StatusBadge.tsx; grep -q "data-dot" components/feature/status/StatusBadge.tsx; grep -q "bg-green-500" components/feature/status/StatusBadge.tsx; grep -q "bg-amber-500" components/feature/status/StatusBadge.tsx; grep -q "bg-destructive" components/feature/status/StatusBadge.tsx; grep -q "statusToTone" components/feature/status/status-to-tone.ts; grep -q "size-11" components/feature/inventory/QtyStepper.tsx; grep -q "useReactTable" components/feature/table/DataTable.tsx; grep -q "useUrlTableState" components/feature/table/DataTable.tsx; grep -q "pageSize = 50" components/feature/table/DataTable.tsx; grep -q "useDebouncedValue" components/feature/table/DataTableToolbar.tsx; npx tsc --noEmit; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - 9 new files exist: StatusBadge.tsx, status-to-tone.ts, QtyStepper.tsx, lib/hooks/use-debounced-value.ts, lib/hooks/use-url-table-state.ts, DataTable.tsx, DataTableToolbar.tsx, DataTablePagination.tsx, DataTableViewOptions.tsx.
    - `components/feature/status/StatusBadge.tsx` uses `cva` AND defines all 5 tones (green/blue/amber/muted/destructive) with the exact Tailwind classes from UI-SPEC.
    - `components/feature/status/status-to-tone.ts` exports `statusToTone` and `statusToLabel`.
    - `components/feature/inventory/QtyStepper.tsx` includes `size-11` (44px touch-target per UI-SPEC).
    - `components/feature/table/DataTable.tsx` uses `useReactTable` AND `useUrlTableState` AND default `pageSize = 50`.
    - `components/feature/table/DataTableToolbar.tsx` uses `useDebouncedValue` with 250ms.
    - `npx tsc --noEmit` exits 0.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <done>StatusBadge maps to UI-SPEC palette exactly, QtyStepper meets 44px floor, DataTable wraps TanStack v8 with URL sync, hooks colocated with consumers, all 9 files compile, build passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Theme cookie (next-themes localStorage) | Client-only theme persistence; no auth implications. |
| URL search params for table state | User-controllable input; rendered into routes. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-01 | Tampering | URL search params drive table state — malicious page numbers or filter values | accept | Client-side TanStack table clamps page out of bounds. Filter values flow through React as text — no SQL/eval. |
| T-03-02 | Information disclosure | `suppressHydrationWarning` may mask other hydration bugs | accept | Required by next-themes; mitigate by keeping ThemeProvider as the ONLY client provider at root. |
| T-03-03 | Spoofing | Status badge tone could be misused to mislead about state | accept | Mapping is centralized in `status-to-tone.ts` so changes propagate. Phase 2 retains this contract. |
</threat_model>

<verification>
- Root layout includes ThemeProvider + Toaster.
- All 11 new files exist + 1 modified file (app/layout.tsx).
- tsc + build both pass.
- StatusBadge tones match UI-SPEC exactly (green/blue/amber/muted/destructive).
- QtyStepper meets WCAG 2.5.5 AAA touch target (44px = size-11).
- DataTable defaults to 50 rows/page (REP-07) and pagination chrome always visible (D-10).
</verification>

<success_criteria>
- Shell primitives complete: theme system + toast wired into root, status/qty/table primitives ready for consumption.
- Every Wave 3 plan can compose without additional primitive work.
- NFR-05 partial satisfied: root layout renders without console errors.
</success_criteria>

<output>
After completion, create `.planning/phases/phase-kayinleong-01/01-03-shell-primitives-SUMMARY.md` summarizing files created, key APIs exposed, and any peer-dep notes from next-themes / sonner with React 19.
</output>
