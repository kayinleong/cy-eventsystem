# Stack Research — cy-eventsystem

**Researched:** 2026-05-24
**Project:** Basic Event Inventory System
**Overall confidence:** HIGH for confirmed stack, MEDIUM-HIGH for capability recommendations.

> **Note on training data staleness.** Next.js 16 shipped substantial breaking changes (middleware→proxy rename, async-only Request APIs, Turbopack default, `next lint` removed, AMP removed, runtime config removed, `revalidateTag` signature changed). Every Next.js 16 claim below was verified against `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`. Do the same before writing code that touches these surfaces.

---

## Core Framework

### Next.js 16.2.6 — App Router only

| Item | Decision | Confidence |
|------|----------|------------|
| Router | **App Router exclusively.** No Pages Router. | HIGH |
| Bundler | **Turbopack** (default in v16; do not pass `--turbopack` flag). | HIGH |
| Linter | **ESLint flat config** (`eslint.config.mjs`). `next lint` is removed; `next build` no longer lints. | HIGH |
| Middleware | **`proxy.ts`**, NOT `middleware.ts`. Renamed in v16. Function must be named `proxy`. Node runtime only — Edge unsupported. | HIGH |
| Request APIs | `cookies()`, `headers()`, `draftMode()`, page/layout `params`, page `searchParams` are **async-only**. Always `await`. | HIGH |
| `revalidateTag` | **Now requires a `cacheLife` profile argument**: `revalidateTag('items', 'max')`. For read-your-writes inside Server Actions, use the new `updateTag(tag)`. | HIGH |
| Caching | Opt into PPR via `cacheComponents: true` (top-level). Skip PPR for MVP. | HIGH |
| React Compiler | Stable but off by default. Keep OFF for MVP. | MEDIUM |
| Parallel routes | Every slot now requires `default.tsx` or build fails. | HIGH |
| Node | 20.9 LTS minimum (target Node 22 LTS for 2026). | HIGH |

**Pattern for this app:**
- **Server Components by default** for read paths — Firestore via Admin SDK in Server Components / Actions / Route Handlers.
- **Server Actions** for all mutations. Validate every action with Zod + re-check auth in the DAL.
- **`'use client'` boundary** only on: scanner widget, data-table interactivity, form widgets needing controlled state.
- **`useActionState` + `useFormStatus`** are the React 19 pattern for form pending/error states.

### React 19.2.4
- App Router uses the React canary that ships with Next.js.
- React 19.2 ships View Transitions, `useEffectEvent`, `<Activity>`. Note for polish phase.
- `useActionState`, `useOptimistic`, `useFormStatus` stable.

### TypeScript 5+
- `^5` is fine. Keep `strict: true`.
- `npx next typegen` generates `PageProps<'/events/[id]'>` etc. — ergonomic for async params.

---

## UI Layer

| Item | Decision | Confidence |
|------|----------|------------|
| Component kit | **shadcn/ui v4** — `style: "radix-nova"`, `baseColor: "neutral"`, `rsc: true`, `cssVariables: true`. | HIGH |
| Primitive package | **Unified `radix-ui`** (already installed `^1.4.3`). Do NOT install individual `@radix-ui/react-*` — consolidated Feb 2026. | HIGH |
| Icons | **`lucide-react`** (already installed). | HIGH |
| Styling | **Tailwind CSS v4** via `@tailwindcss/postcss`. Theme tokens in `app/globals.css` via `@theme inline`. No `tailwind.config.js`. | HIGH |
| Dark mode | `@custom-variant dark` already declared. Pair with `next-themes`. | HIGH |
| Class utils | `clsx` + `tailwind-merge` (already installed). `cn()` from `@/lib/utils`. | HIGH |

### Component install order

**Phase 1 (auth/shell):**
```bash
npx shadcn@latest add button input label form card dropdown-menu avatar sheet sonner
```

**Phase 2 (events/items):**
```bash
npx shadcn@latest add table dialog select badge tabs skeleton alert
```

**Phase 3 (scanning):**
```bash
npx shadcn@latest add command popover
```

Use `sonner` (not `toast`) — shadcn v4's recommended toaster. Mount `<Toaster richColors />` in root layout.

---

## Backend (Firebase)

### Firebase Web SDK 12.13.x

| Capability | Package | Where it runs |
|------------|---------|---------------|
| Auth client (sign-in flow, ID token refresh) | `firebase` (`firebase/auth` modular) | Client Components only |
| Auth server (verify ID token, build session cookie, read claims) | `firebase-admin` | Server / Actions / `proxy.ts` |
| Firestore reads (lists, dashboards) | `firebase-admin/firestore` | Server |
| Firestore reads (live updates: scanner, check-in queue) | `firebase/firestore` modular client | Client `useEffect` |
| Firestore writes | **Server Actions calling `firebase-admin/firestore`** (preferred) | Server |
| Storage (item photos, label PDFs) | Admin for signed URLs; Client for direct uploads | Mixed |

**Install:**
```bash
npm i firebase firebase-admin
```

Pin (May 2026): `firebase` ≥ **12.13.0**, `firebase-admin` ≥ **13.x** LTS.

### Auth pattern — RECOMMENDATION: `next-firebase-auth-edge` v1.12+

| Option | Pros | Cons |
|--------|------|------|
| **A. `next-firebase-auth-edge` (CHOSEN)** | Purpose-built for Next.js 16 + `proxy.ts` + React 19. ID-token verification via Web Crypto. v1.12 explicitly supports Next.js 16. | One dependency; auth-middleware learning curve. |
| B. Roll your own with Firebase session cookies | No third-party dep; uses `auth().createSessionCookie()`. | You write DAL, cookie refresh, claims caching, proxy integration. Larger security surface. |

**Start with Option A.** Spike-validate first day of Phase 2.

### Data layer (DAL)

```
lib/
  firebase/
    admin.ts      // admin app singleton — server-only
    client.ts     // client app singleton — browser-only
  dal.ts          // verifySession(), getCurrentUser(), getEvent(id), getItem(id)
  dto.ts          // ItemDTO, EventDTO — strip server-only fields
```

`admin.ts` and `dal.ts` start with `import 'server-only'`.

---

## Domain-specific libraries

### Barcode / QR scanning — RECOMMENDATION: `@yudiel/react-qr-scanner`

| Library | Verdict |
|---------|---------|
| **`@yudiel/react-qr-scanner` v2.5.1** | **CHOSEN.** React-first; wraps ZXing; exposes torch/zoom/camera-switch; `facingMode: 'environment'`; actively maintained; supports Code 128, EAN, Code 39. |
| `html5-qrcode` (mebjas) | **AVOID for mobile.** Open iOS 17+ Safari issues (black screen, rear-camera failures). |
| `@zxing/library` (raw) | Use only if React wrapper blocks something. |
| Browser `BarcodeDetector` | **Not implemented in any iOS WebKit (2026).** Progressive enhancement only. |

**Guidance:**
- Wrap `<Scanner>` in a Client Component.
- `facingMode: { ideal: 'environment' }`, `aspectRatio: 1`.
- Listen for QR + 1D linear (`code_128`, `ean_13`, `code_39`).
- Debounce duplicate scans (≥1.5s) — ZXing fires repeatedly on held codes.
- iOS Safari quirk: surface "tap to start camera" button; don't auto-start.
- **Always include manual-entry fallback input.**

### Barcode / QR generation — RECOMMENDATION: `bwip-js` v4.10.x

- `bwip-js` unified package works browser + Node. Use `@bwip-js/node` for Route Handlers.
- Item IDs short → encode as **QR** (denser, easier off-angle scan).
- Generate SVG labels in a Route Handler; print via `window.print()` or compose batch PDFs with `pdf-lib`.

### Forms — RECOMMENDATION: react-hook-form + Zod 4

```bash
npm i react-hook-form zod @hookform/resolvers
```

- `react-hook-form` ≥ 7.x, `zod` ≥ 4.x.
- Define schemas once in `lib/schemas/item.ts`; share server↔client.
- Server Actions: `ItemSchema.safeParse(Object.fromEntries(formData))` → return `{ errors }` for `useActionState`.
- Client edit forms: `useForm({ resolver: zodResolver(ItemSchema) })`.

Use plain `useActionState` + `<form>` for simple flows (login, mark-missing confirm). Use RHF for rich multi-field forms with dirty-state tracking.

### Data tables — RECOMMENDATION: TanStack Table v8

```bash
npm i @tanstack/react-table
npx shadcn@latest add table
```

Reference: openstatus.dev data-table example. Used for items list, check-out/in history, missing items, audit log.

### Dates — RECOMMENDATION: date-fns v4

`format`, `formatDistanceToNow`, `isAfter`/`isBefore`, `parseISO`. Add `@date-fns/tz` if timezone-aware event scheduling becomes a requirement.

### State management — RECOMMENDATION: NONE in MVP

1. Server Components + Server Actions as primary "state container."
2. `useState`/`useReducer` for local UI state.
3. URL state (`useSearchParams`, `useRouter`, or `nuqs` later) for filters/sort/pagination.
4. `next-themes` for dark/light.

Only reach for **Zustand v5** if a piece of client state needs sharing across unrelated subtrees AND can't live in the URL (e.g., a scanning session).

### Other supporting libraries

| Library | Purpose |
|---------|---------|
| `sonner` | Toasts via shadcn. Mount `<Toaster />` in root layout. |
| `next-themes` | Light/dark toggle. |
| `server-only` | Guard `admin.ts`, `dal.ts`. |

---

## What NOT to use

| Don't use | Why |
|-----------|-----|
| `middleware.ts` | Renamed to `proxy.ts` in v16. |
| `next lint` | Removed; use `eslint` directly. |
| Synchronous `cookies()`, `headers()`, `params`, `searchParams` | Removed; always `await`. |
| Single-arg `revalidateTag('foo')` | Use `revalidateTag('foo', 'max')` or `updateTag('foo')`. |
| `experimental_ppr` segment config | Removed; use top-level `cacheComponents: true`. |
| `serverRuntimeConfig` / `publicRuntimeConfig` | Removed; use `process.env`. |
| `images.domains` | Deprecated; use `images.remotePatterns`. |
| `next/legacy/image` | Deprecated; use `next/image`. |
| `html5-qrcode` (primary scanner) | Open iOS Safari issues. |
| `reactfire`, `react-firebase-hooks` | Server Components + Admin SDK replaces them. |
| Individual `@radix-ui/react-*` packages | shadcn v4 uses umbrella `radix-ui`. |
| `tailwind.config.js` | Tailwind v4 reads from CSS `@theme inline`. |
| `moment` | Bundle size + mutability. |
| `yup` / `joi` / `superstruct` | Stay with Zod. |
| Redux / RTK / MobX / Jotai | Server Components remove the use case. |
| `firebase-admin` from Client Component | Will try to ship credentials to browser. |

---

## Open questions

1. **Deployment target.** Firebase Hosting / Vercel / self-hosted? `next-firebase-auth-edge` requires cookie name `__session` on Firebase Hosting.
2. **Offline scanning.** Need to work without connectivity at event venues? If yes: service worker + IndexedDB queue. **Flag as later research.**
3. **Print pipeline.** Dedicated label printer (Zebra ZPL/PDF) vs office printer (SVG + `window.print()`).
4. **Multi-tenant?** Single org or multiple orgs? Affects auth claims and Firestore data shape.
5. **`next-firebase-auth-edge` v1.12 API stability.** Validate with 1-day spike in Phase 2.
6. **Live Firestore subscriptions vs polling.** Realtime is "free" but bypasses Server Action validation.

---

## Sources

- Firebase JavaScript SDK Release Notes
- next-firebase-auth-edge docs (Next.js 16 page) + v1.12 release notes
- Firebase Manage Session Cookies (Admin)
- @yudiel/react-qr-scanner npm + GitHub
- html5-qrcode issue #951 (iOS 17+ camera) + #895 (rear camera)
- BarcodeDetector — MDN + caniuse (no WebKit support 2026)
- bwip-js homepage + npm
- shadcn/ui CLI v4 changelog (March 2026) + Unified Radix UI Package (Feb 2026)
- TanStack Table + shadcn reference (openstatus.dev/data-table)
- @hookform/resolvers + Zod 4
- Next.js 16 upgrade docs (`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`)
