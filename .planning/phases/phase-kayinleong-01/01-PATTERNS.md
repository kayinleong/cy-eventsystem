# Phase 1: UI POC — Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** ~110 new + 2 modified
**Analogs found:** 6 in-repo / 110 (rest reference external docs in `node_modules/next/dist/docs/` and library READMEs)

> The codebase is a fresh `create-next-app` scaffold. Only 5 source files exist (`app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `components/ui/button.tsx`, `lib/utils.ts`). For every other Phase 1 file there is no in-repo analog — references point to **Next.js 16 bundled docs** (paths under `node_modules/next/dist/docs/01-app/`) and **library READMEs/docs**. Patterns below use the strongest available reference per file and label it (`in-repo`, `next-docs`, `library-docs`, `shadcn-cli`).
>
> **Mandatory pre-read for every Next-specific file** (per `AGENTS.md`): the relevant page in `node_modules/next/dist/docs/01-app/`. Next.js 16 broke many APIs your training data assumes (async `cookies()`, async `params`/`searchParams`, `proxy.ts` instead of `middleware.ts`, `revalidateTag('tag', 'max')`). Do not write the file from memory.

---

## File Classification

### Foundation files (modified + scaffold)

| File | Action | Role | Data Flow | Closest Analog | Match |
|------|--------|------|-----------|----------------|-------|
| `app/layout.tsx` | modify | root layout | request-response | `app/layout.tsx` (current) | in-repo exact |
| `app/page.tsx` | modify (delete & redirect) | route page | request-response | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md` | next-docs |
| `app/globals.css` | keep (no edit expected) | config | n/a | `app/globals.css` (current) | in-repo exact |
| `package.json` | modify (deps) | config | n/a | `package.json` (current) | in-repo exact |
| `next.config.ts` | keep | config | n/a | `next.config.ts` (current) | in-repo exact |

### Route group: `(auth)` — auth shell (3 pages + 1 layout)

| File | Role | Data Flow | Closest Analog | Match |
|------|------|-----------|----------------|-------|
| `app/(auth)/layout.tsx` | layout (server) | request-response | next-docs `01-app/03-api-reference/03-file-conventions/layout.md` lines 6–22 | next-docs |
| `app/(auth)/login/page.tsx` | route page (client) | form submit → cookie write | `react-hook-form` README + `@hookform/resolvers/zod` README | library-docs |
| `app/(auth)/forgot-password/page.tsx` | route page (client) | form submit → toast → redirect | same as login | library-docs |
| `app/(auth)/set-password/page.tsx` | route page (client) | form submit → toast → redirect | same as login | library-docs |
| `app/(auth)/login/_components/seed-users-disclosure.tsx` | feature component (client) | static list | none | new pattern |

### Route group: `(app)` — main app shell (~28 routes)

| File | Role | Data Flow | Closest Analog | Match |
|------|------|-----------|----------------|-------|
| `app/(app)/layout.tsx` | layout (server) | cookie read → role gate → shell | next-docs `cookies.md` lines 8–16 + `layout.md` lines 158–166 | next-docs |
| `app/(app)/unauthorized/page.tsx` | route page (server) | static | next-docs `unauthorized.md` lines 11–24 | next-docs |
| `app/(app)/page.tsx` (dashboard) | route page (server) | mock store read → KPI cards | next-docs `page.md` lines 8–18 | next-docs |
| `app/(app)/inventory/page.tsx` | route page (server shell) | searchParams → mock filter → table | next-docs `page.md` lines 71–86 (`searchParams`) | next-docs |
| `app/(app)/inventory/new/page.tsx` | route page (client form) | rhf + zod → store.create | library-docs `react-hook-form` + `lib/schemas/item.ts` | library-docs |
| `app/(app)/inventory/[itemId]/page.tsx` | route page (server) | params → mock lookup → detail tabs | next-docs `page.md` lines 42–49 (`params`) | next-docs |
| `app/(app)/inventory/[itemId]/edit/page.tsx` | route page (client form) | params → mock lookup → rhf | next-docs `page.md` + rhf README | mixed |
| `app/(app)/inventory/_components/inventory-table.tsx` | feature component (client) | useSyncExternalStore + TanStack table | `@tanstack/react-table` v8 docs + shadcn `data-table` block | library-docs |
| `app/(app)/inventory/_components/item-form.tsx` | feature component (client) | rhf + zodResolver | rhf README "Get started" | library-docs |
| `app/(app)/inventory/_components/qty-stepper.tsx` | feature component (client) | local state | none — derived from button.tsx pattern | new pattern |
| `app/(app)/inventory/_components/print-label-button.tsx` | feature component (client) | `bwip-js` + `window.print()` | `bwip-js` README "browser usage" | library-docs |
| `app/(app)/events/page.tsx` | route page (server shell) | searchParams → mock filter → table | next-docs `page.md` lines 71–86 | next-docs |
| `app/(app)/events/new/page.tsx` | route page (client form) | rhf + zod → store.createEvent | rhf README | library-docs |
| `app/(app)/events/[eventId]/page.tsx` | route page (server) | params → mock lookup → detail | next-docs `page.md` lines 42–49 | next-docs |
| `app/(app)/events/[eventId]/checkout/page.tsx` | route page (client) | scanner + cart + store.checkout | `@yudiel/react-qr-scanner` README + `useOptimistic` React 19 docs | library-docs |
| `app/(app)/events/[eventId]/checkin/page.tsx` | route page (client) | scanner + return form + store.checkin | same as checkout | library-docs |
| `app/(app)/scan/page.tsx` | route page (client) | scanner widget + event-picker modal | same as checkout | library-docs |
| `app/(app)/reports/stock/page.tsx` | route page (server shell) | mock aggregate → table | next-docs `page.md` + TanStack docs | mixed |
| `app/(app)/reports/out/page.tsx` | route page (server shell) | mock filter → table | same | mixed |
| `app/(app)/reports/missing/page.tsx` | route page (server shell) | mock filter → table | same | mixed |
| `app/(app)/reports/history/page.tsx` | route page (server shell) | mock filter → paginated table | same | mixed |
| `app/(app)/reports/repurchase/page.tsx` | route page (server shell) | mock low-stock filter → table | same | mixed |
| `app/(app)/users/page.tsx` | route page (server shell, admin) | layout gate + mock list | layout.tsx role gate | mixed |
| `app/(app)/settings/page.tsx` | route page (client) | local state | none | new pattern |

### Feature components (cross-cutting, in `components/feature/`)

| File | Role | Data Flow | Closest Analog | Match |
|------|------|-----------|----------------|-------|
| `components/feature/auth/PhaseOnePocRoleSwitcher.tsx` | component (client) | cookie write + router.refresh | next-docs `cookies.md` lines 154–172 + Next.js `useRouter` API | next-docs |
| `components/feature/auth/MockSignInForm.tsx` | component (client) | rhf + cookie set via client action | rhf + cookies.md | mixed |
| `components/feature/scan/ScannerWidget.tsx` | component (client) | camera stream → decode → callback | `@yudiel/react-qr-scanner` README (`<Scanner/>` props) | library-docs |
| `components/feature/scan/ScanCartPanel.tsx` | component (client) | store subscribe + useOptimistic | React 19 `useOptimistic` docs + `lib/mock/store.ts` | mixed |
| `components/feature/scan/ScanHeader.tsx` | component (client) | session state → render selected event | none | new pattern |
| `components/feature/scan/EventPickerCombobox.tsx` | component (client) | combobox + store filter | shadcn `combobox` block docs | shadcn-cli |
| `components/feature/status/StatusBadge.tsx` | component (server-safe) | prop-driven | `components/ui/button.tsx` (cva pattern, in-repo) | in-repo |
| `components/feature/table/DataTablePagination.tsx` | component (client) | TanStack table state → URL sync | TanStack Table v8 "pagination" example + Next.js `useSearchParams`/`useRouter` | library-docs |
| `components/feature/table/DataTableToolbar.tsx` | component (client) | debounced input → globalFilter | TanStack example | library-docs |
| `components/feature/table/DataTableViewOptions.tsx` | component (client) | column visibility | TanStack example | library-docs |
| `components/feature/inventory/QtyStepper.tsx` | component (client) | local controlled state | `components/ui/button.tsx` (cva) | in-repo |
| `components/feature/inventory/ItemForm.tsx` | component (client) | rhf + zodResolver | rhf README | library-docs |
| `components/feature/inventory/InventoryTable.tsx` | component (client) | useSyncExternalStore + TanStack | TanStack docs + `lib/mock/store.ts` | library-docs |
| `components/feature/inventory/LabelPreview.tsx` | component (client) | `bwip-js` SVG render | `bwip-js` README | library-docs |
| `components/feature/events/EventForm.tsx` | component (client) | rhf + zodResolver + date picker | rhf + shadcn `calendar` block | library-docs |
| `components/feature/events/EventCard.tsx` | component (server-safe) | prop-driven | new pattern | new pattern |
| `components/feature/events/TeamLeadCombobox.tsx` | component (client) | combobox + users mock | shadcn `combobox` block docs | shadcn-cli |
| `components/feature/users/InviteUserSheet.tsx` | component (client) | shadcn Sheet + rhf | shadcn `sheet` block | shadcn-cli |
| `components/feature/users/UserRoleSelect.tsx` | component (client) | shadcn Select + onChange | shadcn `select` block | shadcn-cli |
| `components/feature/missing/ResolveMissingSheet.tsx` | component (client) | shadcn Sheet + rhf | shadcn `sheet` block | shadcn-cli |
| `components/feature/missing/MissingItemsTable.tsx` | component (client) | TanStack table | TanStack docs | library-docs |
| `components/feature/dashboard/ActiveEventsWidget.tsx` | component (client) | store subscribe → list | `lib/mock/store.ts` + useSyncExternalStore | library-docs |
| `components/feature/dashboard/LowStockWidget.tsx` | component (client) | store subscribe + selector | same | library-docs |
| `components/feature/dashboard/OverdueReturnsWidget.tsx` | component (client) | store subscribe + selector | same | library-docs |
| `components/feature/dashboard/RecentActivityFeed.tsx` | component (client) | store subscribe → transactions list | same | library-docs |
| `components/feature/shell/AppSidebar.tsx` | component (client) | usePathname → active item | next-docs `layout.md` lines 444–496 (active nav) | next-docs |
| `components/feature/shell/TopBar.tsx` | component (server) | role from layout prop | next-docs `layout.md` | next-docs |
| `components/feature/shell/UserMenu.tsx` | component (client) | dropdown + theme toggle + role switcher + sign out | shadcn `dropdown-menu` block | shadcn-cli |
| `components/feature/shell/MobileNavSheet.tsx` | component (client) | shadcn Sheet | shadcn `sheet` block | shadcn-cli |
| `components/feature/shell/Breadcrumbs.tsx` | component (client) | usePathname → segments | next-docs `layout.md` lines 244–264 | next-docs |

### shadcn UI components (installed via CLI, not paste-edited)

> All of these install via `npx shadcn@latest add <name>` and conform to the shape of the existing `components/ui/button.tsx`. **Do not author them by hand.** Once installed, they may be lightly extended only via wrapper components inside `components/feature/`.

| File | Install Command | Closest Analog |
|------|-----------------|----------------|
| `components/ui/input.tsx` | `npx shadcn@latest add input` | `components/ui/button.tsx` (in-repo shape) |
| `components/ui/label.tsx` | `npx shadcn@latest add label` | same |
| `components/ui/textarea.tsx` | `npx shadcn@latest add textarea` | same |
| `components/ui/select.tsx` | `npx shadcn@latest add select` | same |
| `components/ui/checkbox.tsx` | `npx shadcn@latest add checkbox` | same |
| `components/ui/radio-group.tsx` | `npx shadcn@latest add radio-group` | same |
| `components/ui/switch.tsx` | `npx shadcn@latest add switch` | same |
| `components/ui/form.tsx` | `npx shadcn@latest add form` | same (depends on rhf) |
| `components/ui/card.tsx` | `npx shadcn@latest add card` | same |
| `components/ui/badge.tsx` | `npx shadcn@latest add badge` | same |
| `components/ui/table.tsx` | `npx shadcn@latest add table` | same |
| `components/ui/dialog.tsx` | `npx shadcn@latest add dialog` | same |
| `components/ui/alert-dialog.tsx` | `npx shadcn@latest add alert-dialog` | same |
| `components/ui/sheet.tsx` | `npx shadcn@latest add sheet` | same |
| `components/ui/dropdown-menu.tsx` | `npx shadcn@latest add dropdown-menu` | same |
| `components/ui/tabs.tsx` | `npx shadcn@latest add tabs` | same |
| `components/ui/tooltip.tsx` | `npx shadcn@latest add tooltip` | same |
| `components/ui/breadcrumb.tsx` | `npx shadcn@latest add breadcrumb` | same |
| `components/ui/separator.tsx` | `npx shadcn@latest add separator` | same |
| `components/ui/skeleton.tsx` | `npx shadcn@latest add skeleton` | same |
| `components/ui/avatar.tsx` | `npx shadcn@latest add avatar` | same |
| `components/ui/sonner.tsx` | `npx shadcn@latest add sonner` | same |
| `components/ui/command.tsx` | `npx shadcn@latest add command` | same |
| `components/ui/popover.tsx` | `npx shadcn@latest add popover` | same |
| `components/ui/calendar.tsx` | `npx shadcn@latest add calendar` | same |
| `components/ui/progress.tsx` | `npx shadcn@latest add progress` | same |
| `components/ui/scroll-area.tsx` | `npx shadcn@latest add scroll-area` | same |
| `components/ui/empty-state.tsx` | custom (built on shadcn primitives) | UI-SPEC empty-state contract |
| `components/ui/page-header.tsx` | custom | UI-SPEC heading typography contract |
| `components/ui/theme-toggle.tsx` | custom (uses `next-themes` + `dropdown-menu`) | `next-themes` README "App Router example" |

### Types (`lib/types/`)

| File | Role | Data Flow | Closest Analog | Match |
|------|------|-----------|----------------|-------|
| `lib/types/item.ts` | type def | n/a | `.planning/research/ARCHITECTURE.md` `inventory/{itemId}` schema | research-doc |
| `lib/types/event.ts` | type def | n/a | `.planning/research/ARCHITECTURE.md` `events/{eventId}` schema | research-doc |
| `lib/types/user.ts` | type def | n/a | `.planning/research/ARCHITECTURE.md` `users/{uid}` schema | research-doc |
| `lib/types/transaction.ts` | type def | n/a | `.planning/research/ARCHITECTURE.md` `transactions/{txId}` schema | research-doc |
| `lib/types/missing-item.ts` | type def | n/a | `.planning/research/ARCHITECTURE.md` `missingItems/{missingId}` schema | research-doc |
| `lib/types/session.ts` | type def | n/a | CONTEXT.md D-05 mock cookie shape `{ uid, displayName, email, role, disabled }` | context-doc |

### Zod schemas (`lib/schemas/`)

| File | Role | Data Flow | Closest Analog | Match |
|------|------|-----------|----------------|-------|
| `lib/schemas/item.ts` | validation schema | server↔client | `zod` README v4 + ARCHITECTURE.md `inventory` schema | library-docs |
| `lib/schemas/event.ts` | validation schema | same | same | library-docs |
| `lib/schemas/user.ts` | validation schema | same | same | library-docs |
| `lib/schemas/transaction.ts` | validation schema | same | same | library-docs |
| `lib/schemas/missing-item.ts` | validation schema | same | same | library-docs |
| `lib/schemas/auth.ts` | validation schema (login form) | client only | `zod` README v4 | library-docs |

### Mock data + store (`lib/mock/`)

| File | Role | Data Flow | Closest Analog | Match |
|------|------|-----------|----------------|-------|
| `lib/mock/items.ts` | seed data | static export | research-doc ARCHITECTURE.md `inventory` schema | research-doc |
| `lib/mock/events.ts` | seed data | static export | research-doc ARCHITECTURE.md `events` schema | research-doc |
| `lib/mock/users.ts` | seed data | static export | research-doc ARCHITECTURE.md `users` schema | research-doc |
| `lib/mock/transactions.ts` | seed data | static export | research-doc ARCHITECTURE.md `transactions` schema | research-doc |
| `lib/mock/missing-items.ts` | seed data | static export | research-doc ARCHITECTURE.md `missingItems` schema | research-doc |
| `lib/mock/store.ts` | in-memory store | subscribe / getSnapshot | React 19 `useSyncExternalStore` docs (react.dev) | library-docs |
| `lib/mock/cookie.ts` | mock cookie helpers | read/write `mock_session` | next-docs `cookies.md` lines 96–172 | next-docs |
| `lib/mock/selectors.ts` | selector helpers | pure functions over store snapshot | none — new pattern | new pattern |

### Hooks (`lib/hooks/`)

| File | Role | Data Flow | Closest Analog | Match |
|------|------|-----------|----------------|-------|
| `lib/hooks/use-mock-store.ts` | hook (client) | useSyncExternalStore wrapper | React docs `useSyncExternalStore` | library-docs |
| `lib/hooks/use-debounced-value.ts` | hook (client) | setTimeout-debounced state | standard pattern | new pattern |
| `lib/hooks/use-url-table-state.ts` | hook (client) | URL ↔ TanStack table state sync | TanStack Table v8 docs + Next.js `useSearchParams`/`useRouter` | library-docs |
| `lib/hooks/use-current-user.ts` | hook (client) | reads mock cookie via document.cookie | next-docs `cookies.md` + DOM `document.cookie` | next-docs |

### Project docs (commit alongside code)

| File | Role | Closest Analog | Match |
|------|------|----------------|-------|
| `.planning/phases/phase-kayinleong-01/CLAIM.md` | claim tracker | global CLAUDE.md "CLAIM.md Lifecycle" | project-doc |
| `.planning/STATE.md` | phase tracker (update) | existing file | in-repo |
| `.planning/ROADMAP.md` | phase progress (update) | existing file | in-repo |

---

## Pattern Assignments

### Root layout — `app/layout.tsx` (modify)

**Analog:** existing `app/layout.tsx` (in-repo, lines 1–33) — keep its `Geist` font setup and `html`/`body` skeleton.

**Imports pattern** (preserve from current file, add new):
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";   // NEW: next-themes
import { Toaster } from "@/components/ui/sonner"; // NEW: shadcn sonner wrapper
import "./globals.css";
```

**Pattern to add** (theme provider + toaster wrapping children):
```tsx
<body className="min-h-full flex flex-col">
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    {children}
    <Toaster richColors closeButton />
  </ThemeProvider>
</body>
```

**Metadata update:**
```tsx
export const metadata: Metadata = {
  title: { default: "cy-eventsystem", template: "%s · cy-eventsystem" },
  description: "Event-based physical inventory tracking",
};
```

**Critical:** `<ThemeProvider>` is a Client Component but it accepts server children — the wrapper itself must be a tiny `'use client'` re-export from `components/ui/theme-provider.tsx` per `next-themes` "Next 15 App Router" example.

---

### `app/page.tsx` (replace landing with redirect)

**Analog:** `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`

**Replace entire file with:**
```tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function Root() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.has("mock_session");
  redirect(hasSession ? "/inventory" : "/login"); // dashboard handled by (app) group root
}
```

Or simpler: delete `app/page.tsx` entirely and create `app/(app)/page.tsx` (which becomes `/`) plus a stub at root that redirects unauth → `/login`. Either is acceptable — planner picks.

---

### `(auth)` layout — `app/(auth)/layout.tsx`

**Analog:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md` lines 6–22 (minimal layout).

**Pattern to copy:**
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
```

**Critical:** This is a Server Component (no `'use client'`). The login form inside must be `'use client'`, not the layout.

---

### `(app)` layout — `app/(app)/layout.tsx` (the role-gate spine)

**Analog (combined):**
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` lines 8–16 (async `cookies()`)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md` lines 158–166 (cookie read in layout)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/unauthorized.md` lines 51–80 (`unauthorized()` invocation)

**Imports pattern:**
```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Session } from "@/lib/types/session";
import { AppSidebar } from "@/components/feature/shell/AppSidebar";
import { TopBar } from "@/components/feature/shell/TopBar";
```

**Cookie-read + role-gate pattern** (Phase 1 shape — swap decoder in Phase 2 unchanged):
```tsx
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();                              // NEXT 16: async — never sync
  const raw = jar.get("mock_session")?.value;
  if (!raw) redirect("/login");

  let session: Session;
  try {
    session = JSON.parse(raw) as Session;                   // Phase 1 only; Phase 2 verifies cookie
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh">
      <AppSidebar role={session.role} />
      <div className="flex-1 flex flex-col">
        <TopBar session={session} />
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Critical:** This file must remain a Server Component. The mock cookie is **not** httpOnly per D-05 so the same `Session` can be hydrated on the client via `lib/hooks/use-current-user.ts` reading `document.cookie`.

---

### Per-route role gate (admin-only routes)

**Files:** `app/(app)/users/page.tsx`, `app/(app)/inventory/new/page.tsx`, `app/(app)/inventory/[itemId]/edit/page.tsx`, `app/(app)/events/new/page.tsx`.

**Analog:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/unauthorized.md` lines 51–80.

**Pattern:**
```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Session } from "@/lib/types/session";

async function requireAdmin(): Promise<Session> {
  const jar = await cookies();
  const raw = jar.get("mock_session")?.value;
  if (!raw) redirect("/login");
  const session = JSON.parse(raw) as Session;
  if (session.role !== "admin") redirect("/unauthorized");  // D-07: strict gate
  return session;
}

export default async function NewItemPage() {
  await requireAdmin();
  return <ItemForm mode="create" />;
}
```

Move `requireAdmin()` into a shared `lib/auth/mock-session.ts` helper so all admin-only pages call the same function.

---

### Dynamic-route pages — `app/(app)/inventory/[itemId]/page.tsx`

**Analog:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` lines 42–49 + `PageProps` helper lines 122–138.

**Pattern (use auto-generated `PageProps`):**
```tsx
import { notFound } from "next/navigation";
import { selectItemById } from "@/lib/mock/selectors";
import { getStoreSnapshot } from "@/lib/mock/store";  // server-readable snapshot (mock — phase 1 only)

export default async function ItemDetailPage(props: PageProps<"/inventory/[itemId]">) {
  const { itemId } = await props.params;             // NEXT 16: await params
  const snapshot = getStoreSnapshot();
  const item = selectItemById(snapshot, itemId);
  if (!item) notFound();
  return <ItemDetail item={item} />;
}
```

**Critical:** Run `npx next typegen` once so `PageProps<'/inventory/[itemId]'>` resolves. Never use the legacy synchronous `params` form.

---

### List pages with URL search params — `app/(app)/inventory/page.tsx`

**Analog:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` lines 71–86 (`searchParams`).

**Pattern (server shell that hands searchParams to a client table):**
```tsx
import { InventoryTable } from "./_components/inventory-table";

export default async function InventoryListPage(props: PageProps<"/inventory">) {
  const sp = await props.searchParams;                 // NEXT 16: await searchParams
  const initial = {
    q: typeof sp.q === "string" ? sp.q : "",
    category: typeof sp.category === "string" ? sp.category : "",
    status: typeof sp.status === "string" ? sp.status : "",
    page: Number(sp.page ?? 1),
  };
  return <InventoryTable initial={initial} />;
}
```

The client component (`InventoryTable`) subscribes to the store and the URL — see the data-table pattern below.

---

### Mock store — `lib/mock/store.ts`

**Analog:** React 19 `useSyncExternalStore` docs (`https://react.dev/reference/react/useSyncExternalStore`) — this is the canonical reference because there is no in-repo store yet.

**Required surface (per D-02 and demo flow):**
```ts
import type { Item } from "@/lib/types/item";
import type { Event } from "@/lib/types/event";
import type { User } from "@/lib/types/user";
import type { Transaction } from "@/lib/types/transaction";
import type { MissingItem } from "@/lib/types/missing-item";

import { seedItems } from "./items";
import { seedEvents } from "./events";
import { seedUsers } from "./users";
import { seedTransactions } from "./transactions";
import { seedMissingItems } from "./missing-items";

export type StoreSnapshot = Readonly<{
  items: readonly Item[];
  events: readonly Event[];
  users: readonly User[];
  transactions: readonly Transaction[];
  missingItems: readonly MissingItem[];
}>;

let state: StoreSnapshot = Object.freeze({
  items: seedItems,
  events: seedEvents,
  users: seedUsers,
  transactions: seedTransactions,
  missingItems: seedMissingItems,
});
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export function getSnapshot(): StoreSnapshot { return state; }
export function getServerSnapshot(): StoreSnapshot { return state; }  // SSR

// Mutators (D-02, D-14). Each one is a pure transform + emit.
export function checkout(args: { eventId: string; lines: { itemId: string; qty: number }[]; actor: User }): void {
  state = Object.freeze(/* immutable transform: decrement availableQty, increment outQty, push checkout transactions */ state);
  emit();
}
export function checkin(args: { /* ... */ }): void { state = /* ... */; emit(); }
export function createItem(input: Item): void { /* ... */ emit(); }
export function updateItem(itemId: string, patch: Partial<Item>): void { /* ... */ emit(); }
export function retireItem(itemId: string): void { /* ... */ emit(); }
export function createEvent(input: Event): void { /* ... */ emit(); }
export function resolveMissing(missingId: string, resolution: "found" | "writtenOff"): void { /* ... */ emit(); }
```

**Critical rules:**
- Treat snapshots as immutable. Never mutate `state` in place — return a fresh frozen object so `useSyncExternalStore` detects the change via reference equality.
- Do **not** persist (no `localStorage`). State resets on full reload per D-02.
- The store is `'use client'`-safe but does not need the directive at the top — it's a plain module. The directive lives on the component that consumes it.

---

### Mock store consumer hook — `lib/hooks/use-mock-store.ts`

**Pattern:**
```tsx
"use client";
import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot, getServerSnapshot } from "@/lib/mock/store";

export function useMockStore<T>(selector: (s: ReturnType<typeof getSnapshot>) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(getServerSnapshot()),
  );
}
```

Used by every dashboard widget, table, and scan-cart component.

---

### Mock cookie helpers — `lib/mock/cookie.ts`

**Analog:** `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` lines 154–193 (server-side set) — client-side counterpart is `document.cookie`.

**Server helper** (for the login Server Action or, if Phase 1 uses a client-side mock, this file may be skipped entirely):
```ts
"use server";
import { cookies } from "next/headers";
import type { Session } from "@/lib/types/session";

export async function setMockSession(session: Session) {
  const jar = await cookies();
  jar.set("mock_session", JSON.stringify(session), {
    httpOnly: false,        // D-05: non-httpOnly so role switcher can read in client
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,   // 1 day
  });
}
export async function clearMockSession() {
  const jar = await cookies();
  jar.set("mock_session", "", { maxAge: 0, path: "/" });
}
```

**Client helper** (used by `PhaseOnePocRoleSwitcher` for synchronous role flip):
```ts
"use client";
import type { Session } from "@/lib/types/session";
export function writeMockSessionClient(session: Session) {
  const value = encodeURIComponent(JSON.stringify(session));
  document.cookie = `mock_session=${value}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
}
export function readMockSessionClient(): Session | null {
  const match = document.cookie.match(/(?:^|; )mock_session=([^;]+)/);
  if (!match) return null;
  try { return JSON.parse(decodeURIComponent(match[1])) as Session; } catch { return null; }
}
```

---

### Sign-in form — `app/(auth)/login/page.tsx` + `components/feature/auth/MockSignInForm.tsx`

**Analog:** `react-hook-form` README "Get started" + `@hookform/resolvers/zod` quick-start (library-docs); shadcn `form` block (CLI install).

**Imports pattern:**
```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoginSchema, type LoginInput } from "@/lib/schemas/auth";
import { seedUsers } from "@/lib/mock/users";
import { writeMockSessionClient } from "@/lib/mock/cookie";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
```

**Form pattern** (rhf + zodResolver + onBlur per CONTEXT D-08 / claude-discretion):
```tsx
const form = useForm<LoginInput>({
  resolver: zodResolver(LoginSchema),
  mode: "onBlur",
  defaultValues: { email: "", password: "" },
});

async function onSubmit(values: LoginInput) {
  const user = seedUsers.find((u) => u.email === values.email);
  if (!user || values.password !== "password" || user.disabled) {
    form.setError("password", { message: "Wrong email or password." });
    return;
  }
  writeMockSessionClient({
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    disabled: user.disabled,
  });
  toast.success("Signed in");
  router.push("/");
}
```

**JSX (every form input wired through `<FormField/>`):**
```tsx
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
    <FormField
      control={form.control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl><Input type="email" autoComplete="email" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    {/* password field … */}
    <Button type="submit" className="w-full">Sign in</Button>
  </form>
</Form>
```

**Apply this pattern to all forms:** item create/edit, event create/edit, invite user, set low-stock threshold, resolve missing item, forgot-password, set-password.

---

### Zod schema — `lib/schemas/item.ts` (and siblings)

**Analog:** `zod` v4 README + `lib/types/item.ts` (this file) — schemas live in `lib/schemas/` per CONTEXT "form + schema strategy" so Phase 2 can import without changes.

**Pattern:**
```ts
import { z } from "zod";

export const ItemSchema = z.object({
  name: z.string().min(1, "Name is required."),
  sku: z.string().min(1, "SKU is required.").regex(/^[A-Z0-9-]+$/i, "Letters, digits, hyphens only."),
  category: z.enum(["Audio", "Lighting", "Display", "Marketing"]),
  totalQty: z.number().int().nonnegative(),
  availableQty: z.number().int().nonnegative(),
  outQty: z.number().int().nonnegative(),
  unit: z.string().min(1),
  photoUrl: z.string().url().nullable(),
  notes: z.string().max(2000).default(""),
}).refine(
  (v) => v.availableQty + v.outQty === v.totalQty,
  { message: "available + out must equal total.", path: ["availableQty"] }
);
export type ItemInput = z.input<typeof ItemSchema>;
export type Item = z.output<typeof ItemSchema>;
```

**Apply mirroring to** `event.ts`, `user.ts`, `transaction.ts`, `missing-item.ts`, `auth.ts`. **Critical:** schemas must mirror ARCHITECTURE.md so Phase 2's Server Actions can `safeParse(formData)` against the same file.

---

### TanStack data-table — `components/feature/inventory/InventoryTable.tsx`

**Analog:** TanStack Table v8 docs (`@tanstack/react-table` README) + shadcn `data-table` block — both library-docs. Reference example: openstatus.dev data-table (cited in STACK.md).

**Imports pattern:**
```tsx
"use client";
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, flexRender,
  type ColumnDef, type SortingState, type ColumnFiltersState,
} from "@tanstack/react-table";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { useMockStore } from "@/lib/hooks/use-mock-store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
```

**Column definitions** (selective sortable per D-11):
```tsx
const columns: ColumnDef<Item>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
        Name <ArrowUpDown className="ml-2 size-3" />
      </Button>
    ),
  },
  {
    accessorKey: "sku",
    header: "SKU",
    cell: ({ row }) => <span className="font-mono text-sm">{row.original.sku}</span>,
  },
  // … availableQty (sortable), status (sortable), category (not sortable), actions
];
```

**URL-sync pattern** (D-09 / D-10 / D-11 / D-12 — pagination + filter + sort all bidirectional with searchParams):
```tsx
const router = useRouter();
const pathname = usePathname();
const searchParams = useSearchParams();

const pageIndex = Number(searchParams.get("page") ?? "1") - 1;
const globalFilter = searchParams.get("q") ?? "";

const pushParam = (key: string, value: string | undefined) => {
  const next = new URLSearchParams(searchParams);
  if (!value) next.delete(key); else next.set(key, value);
  router.replace(`${pathname}?${next.toString()}`, { scroll: false });   // D-09
};

const table = useReactTable({
  data: items,
  columns,
  state: { sorting, columnFilters, globalFilter, pagination: { pageIndex, pageSize: 50 } },
  onPaginationChange: (updater) => {
    const next = typeof updater === "function" ? updater({ pageIndex, pageSize: 50 }) : updater;
    pushParam("page", String(next.pageIndex + 1));
  },
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
});
```

**Apply this pattern to:** every list page (inventory, events, users, reports/*). Hoist the URL-sync block into `lib/hooks/use-url-table-state.ts` so each table is a thin column-definitions file.

---

### Scanner widget — `components/feature/scan/ScannerWidget.tsx`

**Analog:** `@yudiel/react-qr-scanner` v2.5.1 README (library-docs) + PITFALLS.md "iOS Safari camera" lines 234–268.

**Imports pattern:**
```tsx
"use client";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useState, useRef } from "react";
import { toast } from "sonner";
```

**Component pattern** (debounced + all 5 formats per D-16):
```tsx
export function ScannerWidget({ onScan, paused = false }: { onScan: (value: string) => void; paused?: boolean }) {
  const lastValue = useRef<{ value: string; at: number } | null>(null);

  return (
    <div className="aspect-square w-full max-w-md">
      <Scanner
        formats={["qr_code", "code_128", "ean_13", "upc_a", "data_matrix"]}  // D-16 / CO-09
        paused={paused}
        constraints={{ facingMode: { ideal: "environment" } }}
        scanDelay={150}
        onScan={(results) => {
          const value = results[0]?.rawValue;
          if (!value) return;
          const now = Date.now();
          if (lastValue.current && lastValue.current.value === value && now - lastValue.current.at < 1500) return;
          lastValue.current = { value, at: now };
          if ("vibrate" in navigator) navigator.vibrate(50);
          onScan(value);
        }}
        onError={(e) => {
          if (e?.name === "NotAllowedError") toast.error("Camera access needed");
          else toast.error("Couldn't read code");
        }}
      />
    </div>
  );
}
```

**Critical:** `playsinline` + `muted` are handled by the library wrapper. Confirm the `<video>` props in the library's installed source if iOS Safari misbehaves. Per CLAUDE.md Phase 1 rules: the scanned value is **logged to the mock store**, not persisted across reloads.

---

### Scan cart with optimistic UI — `components/feature/scan/ScanCartPanel.tsx`

**Analog:** React 19 `useOptimistic` docs (react.dev) + `lib/mock/store.ts` shape above.

**Imports pattern:**
```tsx
"use client";
import { useOptimistic, useState, useTransition } from "react";
import { checkout as mockCheckout } from "@/lib/mock/store";
import { useMockStore } from "@/lib/hooks/use-mock-store";
import { toast } from "sonner";
```

**Pattern (locks Phase 2 contract — `mockCheckout` swaps for a Server Action without UI changes):**
```tsx
const [cart, setCart] = useState<CartLine[]>([]);
const [optimisticCart, addOptimistic] = useOptimistic(cart, (state, line: CartLine) => [...state, line]);
const [isPending, startTransition] = useTransition();

function addLine(itemId: string) {
  const item = items.find((i) => i.id === itemId);
  if (!item || item.availableQty <= 0) {
    toast.error("Not enough stock");
    return;
  }
  startTransition(() => {
    addOptimistic({ itemId, qty: 1 });        // optimistic
    setCart((c) => [...c, { itemId, qty: 1 }]); // committed (mock — instant)
  });
}

function confirmCheckout() {
  mockCheckout({ eventId, lines: cart, actor: currentUser });
  setCart([]);
  toast.success(`${cart.length} items checked out`);  // matches UI-SPEC toast pattern
}
```

---

### Status badge — `components/feature/status/StatusBadge.tsx`

**Analog (in-repo!):** `components/ui/button.tsx` lines 7–42 — same `cva` pattern.

**Pattern (mirrors button's cva structure but applies UI-SPEC dot colors):**
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

export function StatusBadge({
  tone,
  children,
  className,
}: VariantProps<typeof statusBadgeVariants> & { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(statusBadgeVariants({ tone, className }))}>
      <span data-dot className="size-1.5 rounded-full" />
      {children}
    </span>
  );
}
```

Status-to-tone mapping table is locked in UI-SPEC "Status Palette (Q4)" — wire it through a small adjacent helper `statusToTone(status)`.

---

### Theme toggle — `components/ui/theme-toggle.tsx`

**Analog:** `next-themes` README "App Router example".

**Pattern:**
```tsx
"use client";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
        <DropdownMenuItem onClick={() => setTheme("light")}><Sun className="mr-2 size-4" />Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}><Moon className="mr-2 size-4" />Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}><Monitor className="mr-2 size-4" />System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

### Active-nav sidebar — `components/feature/shell/AppSidebar.tsx`

**Analog:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md` lines 444–626 (`usePathname` active-link pattern).

**Pattern:**
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Calendar, ScanLine, BarChart3, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/",           label: "Dashboard", icon: Package, roles: ["admin", "staff"] as const },
  { href: "/inventory",  label: "Inventory", icon: Package, roles: ["admin", "staff"] as const },
  { href: "/scan",       label: "Scan",      icon: ScanLine, roles: ["admin", "staff"] as const },
  { href: "/events",     label: "Events",    icon: Calendar, roles: ["admin", "staff"] as const },
  { href: "/reports/stock", label: "Reports", icon: BarChart3, roles: ["admin", "staff"] as const },
  { href: "/users",      label: "Users",     icon: Users,    roles: ["admin"] as const },
  { href: "/settings",   label: "Settings",  icon: Settings, roles: ["admin", "staff"] as const },
];

export function AppSidebar({ role }: { role: "admin" | "staff" }) {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 flex-col border-r bg-sidebar">
      <nav className="flex flex-col gap-1 p-3">
        {items.filter((i) => i.roles.includes(role)).map((i) => {
          const active = pathname === i.href || (i.href !== "/" && pathname.startsWith(i.href));
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground",
              )}
            >
              <i.icon className="size-4" />
              {i.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

---

### Breadcrumbs — `components/feature/shell/Breadcrumbs.tsx`

**Analog:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md` lines 244–264.

Copy-shape directly; replace decoration with the shadcn `breadcrumb` block components.

---

### Role switcher (POC-only) — `components/feature/auth/PhaseOnePocRoleSwitcher.tsx`

**Analog (combined):**
- `next-docs` cookies.md client behavior
- `next/navigation` `useRouter` for `router.refresh()`

**Pattern (D-06):**
```tsx
"use client";
import { useRouter } from "next/navigation";
import { readMockSessionClient, writeMockSessionClient } from "@/lib/mock/cookie";
import { DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";

export function PhaseOnePocRoleSwitcher() {
  const router = useRouter();
  const session = readMockSessionClient();
  if (!session) return null;

  const flip = (role: "admin" | "staff") => {
    writeMockSessionClient({ ...session, role });
    router.refresh();    // forces (app)/layout.tsx server component to re-evaluate role
  };

  return (
    <>
      <DropdownMenuLabel>Switch role (POC only)</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={session.role} onValueChange={(v) => flip(v as "admin" | "staff")}>
        <DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="staff">Staff</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  );
}
```

The filename's `PhaseOnePoc` prefix is deliberate (per D-06 / specifics) — easy to grep & delete in Phase 2.

---

### Print label — `components/feature/inventory/LabelPreview.tsx`

**Analog:** `bwip-js` README "browser usage" (library-docs).

**Pattern:**
```tsx
"use client";
import { useEffect, useRef } from "react";
import bwipjs from "bwip-js/browser";

export function LabelPreview({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    bwipjs.toCanvas(canvasRef.current, {
      bcid: "qrcode",
      text: value,
      scale: 4,
      includetext: false,
    });
  }, [value]);
  return <canvas ref={canvasRef} className="bg-white" />;
}
```

Pair with a print-only wrapper:
```tsx
<style jsx global>{`
  @media print {
    body * { visibility: hidden; }
    #print-area, #print-area * { visibility: visible; }
    #print-area { position: absolute; left: 0; top: 0; }
  }
`}</style>
```

---

### Empty state — `components/ui/empty-state.tsx`

**Analog:** UI-SPEC "Empty-state visual" section + the 7 copies table.

**Pattern (centered vertical stack per spec):**
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

Use the UI-SPEC copy table verbatim. No paraphrasing.

---

### Page header — `components/ui/page-header.tsx`

**Analog:** UI-SPEC Typography table (Heading-M 18px / 600).

**Pattern:**
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

---

## Shared Patterns (cross-cutting — apply across multiple plans)

### Shared #1 — Async dynamic APIs (Next.js 16 mandatory)

**Source:** `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` + `03-file-conventions/page.md` + `03-file-conventions/layout.md`.

**Apply to:** every page that uses `params`, `searchParams`, `cookies`, or `headers`. That is the majority of `(app)/**/page.tsx` files plus `(app)/layout.tsx`.

```tsx
// ALWAYS:
const jar = await cookies();
const { itemId } = await props.params;
const sp = await props.searchParams;

// NEVER (Next.js 16 removes the synchronous form):
const { itemId } = props.params;       // ❌ build error
const jar = cookies();                  // ❌ type error
```

Use the auto-generated `PageProps<'/route/[id]'>` and `LayoutProps<'/route'>` helpers (run `npx next typegen` after route changes).

### Shared #2 — Server-vs-client boundary

**Source:** `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`.

**Apply to:** every component.

**Rules:**
- Default = Server Component (no directive). Cheap, no JS shipped.
- Add `'use client'` (top of file, above imports) only when the file needs: `useState`, `useEffect`, `useReducer`, `useOptimistic`, `useSyncExternalStore`, browser APIs (`document.cookie`, camera, `localStorage`, `window.print`), event handlers (`onClick`, `onChange`, `onSubmit`).
- Lists of files **that must** have `'use client'` in Phase 1:
  - Every form (rhf needs hooks)
  - Every table (TanStack hooks)
  - Scanner widget, scan cart, scan header
  - Role switcher, theme toggle, user menu
  - All dashboard widgets (store subscription)
  - Breadcrumbs, mobile nav sheet, active sidebar
- Lists of files **that must NOT** have `'use client'`:
  - All route group layouts (`(auth)/layout.tsx`, `(app)/layout.tsx`)
  - All page shells that read `cookies()`, `params`, `searchParams` server-side (then hand data to a small client island)
  - `app/layout.tsx` (root)

### Shared #3 — Form pattern (rhf + zodResolver + shadcn Form)

**Source:** rhf README "Quick Start" + `@hookform/resolvers/zod` README + shadcn `form` block.

**Apply to:** every form in Phase 1 — login, forgot-password, set-password, item create/edit, event create/edit, invite user, set-threshold, resolve missing.

**Boilerplate (already shown in detail above for sign-in form). Replicate:**
1. `useForm<T>({ resolver: zodResolver(Schema), mode: 'onBlur', defaultValues })`
2. Wrap in `<Form {...form}>` + native `<form onSubmit={form.handleSubmit(onSubmit)}>`
3. Every input wired through `<FormField/>` → `<FormItem/>` → `<FormLabel/>` → `<FormControl/>` + `<FormMessage/>`
4. `onSubmit` is async; for Phase 1, it calls the mock store directly and shows a `sonner` toast.

### Shared #4 — Mock store consumption

**Apply to:** every component that needs live data — all tables, all dashboard widgets, scan cart, header counts.

```tsx
"use client";
import { useMockStore } from "@/lib/hooks/use-mock-store";
import { selectLowStockItems, selectActiveEvents } from "@/lib/mock/selectors";

export function LowStockWidget() {
  const items = useMockStore(selectLowStockItems);
  // …
}
```

Selectors live in `lib/mock/selectors.ts` and are pure functions of `StoreSnapshot`. Same selectors are reusable in Phase 2 against a Firestore-backed snapshot shape.

### Shared #5 — URL state for filters/sort/pagination

**Source:** TanStack Table v8 docs + Next.js `useSearchParams` / `useRouter` / `usePathname`.

**Apply to:** every list page (inventory, events, users, reports/stock, reports/out, reports/missing, reports/history, reports/repurchase).

**Hoist the pattern into:** `lib/hooks/use-url-table-state.ts` — returns `{ pagination, sorting, columnFilters, globalFilter, set... }` all bidirectional with the URL via `router.replace(?, { scroll: false })`.

### Shared #6 — Toast feedback (sonner)

**Apply to:** every mutation (mock store mutators, form submissions, scan events, role switches, destructive actions).

**Voice contract (UI-SPEC):**
- Success: `{Noun} {past-tense verb}` → `toast.success("Item added")`
- Error: `Couldn't {verb} {noun}` → `toast.error("Couldn't save changes")`
- Undo: `toast("Item retired", { action: { label: "Undo", onClick: ... } })`

### Shared #7 — Destructive confirmations (AlertDialog)

**Source:** UI-SPEC "Destructive confirmations (Q9)" table.

**Apply to:** Retire item, Cancel event, Disable user, Write off item.

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild><Button variant="destructive">Retire</Button></AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Retire this item?</AlertDialogTitle>
      <AlertDialogDescription>
        It will be removed from active inventory and won't appear in scans or events. Past history is kept.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={confirm} className="bg-destructive text-destructive-foreground">
        Retire item
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Use the UI-SPEC table's exact dialog title, body, and confirm label. No paraphrasing.

### Shared #8 — Sheet vs Dialog selection

**Source:** UI-SPEC "Layout & Route Patterns" table.

| Pattern | Use for |
|---------|---------|
| Full-page route | `/inventory/new`, `/inventory/[id]/edit`, `/events/new`, `/users/new` |
| `<Sheet/>` right slide-over | Invite user, set low-stock threshold, resolve missing item, quick tag rename |
| `<AlertDialog/>` | Destructive confirms only (see Shared #7) |
| `<Dialog/>` | Generic non-destructive modals (e.g. post-scan event picker per D-15) |

### Shared #9 — POC seed users disclosure

**Apply to:** `app/(auth)/login/page.tsx` only.

Render a tiny `<details>` block below the form listing the 5 seed emails (password `password`). One-click fills the form via `form.setValue('email', '...')`. **Mark the component file with a `// PHASE 1 ONLY — REMOVE IN PHASE 2` banner comment.**

### Shared #10 — Status enum → tone mapping

**Apply to:** every place that renders a status — table cells, detail headers, dashboard widgets.

```ts
// lib/feature/status.ts (or co-located in StatusBadge)
export function statusToTone(s: ItemStatus | EventStatus | MissingStatus | TransactionType) {
  if (s === "available" || s === "planned" || s === "active") return "green";
  if (s === "checked_out" || s === "in-progress") return "blue";
  if (s === "damaged" || s === "low-stock" || s === "overdue") return "amber";
  if (s === "retired" || s === "completed" || s === "cancelled") return "muted";
  if (s === "missing") return "destructive";
  return "muted";
}
```

UI-SPEC "Status Palette (Q4)" is the source of truth for this mapping.

---

## No Analog Found

These files have no codebase analog AND no close library/docs counterpart. Planner must derive the design from CONTEXT.md + UI-SPEC.md + ARCHITECTURE.md alone, treating them as new patterns. Keep them small and well-commented.

| File | Role | Why no analog |
|------|------|---------------|
| `lib/mock/selectors.ts` | pure selectors over the mock store | First instance of this pattern in the project. Phase 2 will replace its body but keep its API. |
| `lib/mock/store.ts` mutators (`checkout`, `checkin`, `resolveMissing`, …) | business logic in a phase-1-only file | Bespoke to Phase 1; Phase 2 swaps each for a Server Action with the same signature. |
| `components/feature/scan/ScanHeader.tsx` | session-scoped event picker stickiness (D-15) | New UX pattern; no library precedent. Pure React state + `useReducer` recommended. |
| `components/feature/inventory/QtyStepper.tsx` | 44px-touch-target +/- stepper (UI-SPEC accessibility floor) | Bespoke composite. Build on `<Button/>` (in-repo analog) + `<Input type="number"/>`. |
| `app/(app)/settings/page.tsx` | Phase 1 placeholder | Minimal: theme toggle echo + 1 fake "low-stock threshold" form. |

---

## Metadata

**Analog search scope:**
- `/Users/ka.yin.leong/Documents/cy-eventsystem/app/` (5 files)
- `/Users/ka.yin.leong/Documents/cy-eventsystem/components/` (1 file)
- `/Users/ka.yin.leong/Documents/cy-eventsystem/lib/` (1 file)
- `/Users/ka.yin.leong/Documents/cy-eventsystem/node_modules/next/dist/docs/01-app/` (Next.js 16 bundled docs — verified for `page.md`, `layout.md`, `cookies.md`, `unauthorized.md`, `route-groups.md`, `05-server-and-client-components.md`, `04-linking-and-navigating.md`)
- `.planning/research/STACK.md`, `ARCHITECTURE.md`, `FEATURES.md`, `PITFALLS.md` (cross-referenced for library choices, schema shapes, known traps)

**Files scanned:** 22 (5 in-repo source + 5 in-repo docs + 7 Next 16 docs + 5 research docs)

**Pattern extraction date:** 2026-05-24

**Per-file mandatory reading for the planner / executor:**
- Every Next.js-specific file → relevant doc in `node_modules/next/dist/docs/01-app/` (linked per file above)
- Every shadcn component → install via CLI, never paste-edit; the in-repo `components/ui/button.tsx` (lines 1–67) is the canonical shape reference for what shadcn output looks like in this project
- Every form → rhf README + shadcn `form` block; **mirror** the sign-in example above (Pattern Assignments § Sign-in form)
- Every table → TanStack v8 + shadcn `data-table` block; **mirror** the InventoryTable example above
- Every status display → UI-SPEC "Status Palette (Q4)" table + `StatusBadge.tsx` pattern above
