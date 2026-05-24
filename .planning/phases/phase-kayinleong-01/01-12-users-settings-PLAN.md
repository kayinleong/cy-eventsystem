---
phase: 01-ui-poc
plan: 12
type: execute
wave: 3
depends_on: [01, 02, 03, 04]
files_modified:
  - app/(app)/users/page.tsx
  - app/(app)/users/invite/page.tsx
  - app/(app)/settings/page.tsx
  - components/feature/users/UsersTable.tsx
  - components/feature/users/InviteUserSheet.tsx
  - components/feature/users/UserRoleSelectInline.tsx
  - components/feature/users/DisableUserButton.tsx
  - components/feature/settings/ThemePreferencesCard.tsx
  - components/feature/settings/LowStockThresholdsCard.tsx
autonomous: true
requirements:
  - AUTH-07
  - AUTH-08
  - AUTH-09
  - AUTH-10
  - RP-01
  - NFR-05

must_haves:
  truths:
    - "/users is admin-only (D-07) and lists all users with role + disabled status."
    - "/users/invite is admin-only and uses Zod-validated form to call store.inviteUser."
    - "Admin can change a user's role inline via a Select that calls store.setUserRole (AUTH-08)."
    - "Admin can disable a user via destructive AlertDialog calling store.disableUser (AUTH-09)."
    - "Disabled users show a 'Disabled' badge per AUTH-09 surface."
    - "/settings has 2 cards: theme preferences (light/dark/system reflecting next-themes) and low-stock thresholds (table of items with inline threshold editor)."
    - "Settings is reachable by both admin and staff but the low-stock threshold editor is admin-only."
  artifacts:
    - path: "app/(app)/users/page.tsx"
      provides: "Admin-only users list"
      contains: "requireAdmin"
    - path: "app/(app)/users/invite/page.tsx"
      provides: "Admin-only invite form"
      contains: "requireAdmin"
    - path: "components/feature/users/UsersTable.tsx"
      provides: "User list with inline role select + disable action"
      contains: "setUserRole"
    - path: "components/feature/users/InviteUserSheet.tsx"
      provides: "Invite user form (Sheet or full page — UI-SPEC allows either)"
      contains: "InviteUserSchema"
    - path: "components/feature/settings/ThemePreferencesCard.tsx"
      provides: "Theme controls"
      contains: "next-themes"
    - path: "components/feature/settings/LowStockThresholdsCard.tsx"
      provides: "Admin-editable threshold per item"
      contains: "updateLowStockThreshold"
  key_links:
    - from: "components/feature/users/UsersTable.tsx"
      to: "lib/mock/store.ts setUserRole + disableUser"
      via: "Inline controls per row"
      pattern: "setUserRole|disableUser"
    - from: "components/feature/users/InviteUserSheet.tsx"
      to: "lib/schemas/user.ts InviteUserSchema + lib/mock/store.ts inviteUser"
      via: "rhf submit dispatches inviteUser"
      pattern: "inviteUser"
---

<objective>
Build the users feature (admin-only): list, invite, inline role change, disable. Plus the settings page (theme prefs + low-stock thresholds).

Output: 3 route files + 6 feature components.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/phases/phase-kayinleong-01/01-UI-SPEC.md
@.planning/phases/phase-kayinleong-01/01-CONTEXT.md
@lib/types/user.ts
@lib/schemas/user.ts
@lib/mock/store.ts
@lib/mock/selectors.ts
@lib/mock/users.ts
@lib/auth/mock-session.ts
@lib/hooks/use-mock-store.ts
@lib/hooks/use-current-user.ts
@components/ui/page-header.tsx
@components/ui/card.tsx
@components/ui/sheet.tsx
@components/ui/form.tsx
@components/ui/input.tsx
@components/ui/select.tsx
@components/ui/button.tsx
@components/ui/badge.tsx
@components/ui/alert-dialog.tsx
@components/ui/empty-state.tsx
@components/ui/radio-group.tsx
@components/feature/table/DataTable.tsx
@components/feature/status/StatusBadge.tsx

<interfaces>
```tsx
export function UsersTable(): React.ReactElement;
export function InviteUserSheet(): React.ReactElement;
export function UserRoleSelectInline(props: { uid: string; currentRole: UserRole; disabled?: boolean }): React.ReactElement;
export function DisableUserButton(props: { uid: string; displayName: string; alreadyDisabled: boolean }): React.ReactElement;
export function ThemePreferencesCard(): React.ReactElement;
export function LowStockThresholdsCard(props: { isAdmin: boolean }): React.ReactElement;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: UsersTable, InviteUserSheet, UserRoleSelectInline, DisableUserButton</name>
  <files>
    components/feature/users/UsersTable.tsx,
    components/feature/users/InviteUserSheet.tsx,
    components/feature/users/UserRoleSelectInline.tsx,
    components/feature/users/DisableUserButton.tsx
  </files>
  <read_first>
    - .planning/REQUIREMENTS.md AUTH-07, AUTH-08, AUTH-09, AUTH-10
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md destructive confirmation row for Disable user
    - lib/schemas/user.ts (InviteUserSchema)
    - lib/mock/store.ts (inviteUser, setUserRole, disableUser)
    - components/ui/sheet.tsx
  </read_first>
  <action>
    **components/feature/users/UserRoleSelectInline.tsx** (AUTH-08):
    ```tsx
    "use client";
    import { toast } from "sonner";
    import {
      Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
    } from "@/components/ui/select";
    import { setUserRole } from "@/lib/mock/store";
    import { seedUsers } from "@/lib/mock/users";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";
    import type { UserRole } from "@/lib/types/user";

    export function UserRoleSelectInline({
      uid,
      currentRole,
      disabled = false,
    }: {
      uid: string;
      currentRole: UserRole;
      disabled?: boolean;
    }) {
      const session = useCurrentUser();

      function change(role: UserRole) {
        if (role === currentRole) return;
        const actor = session ? seedUsers.find((u) => u.uid === session.uid) : undefined;
        if (!actor) { toast.error("Couldn't change role"); return; }
        setUserRole(uid, role, actor);
        toast.success(`Role updated to ${role}`);
      }

      return (
        <Select value={currentRole} onValueChange={(v) => change(v as UserRole)} disabled={disabled}>
          <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    ```

    **components/feature/users/DisableUserButton.tsx** (AUTH-09 — UI-SPEC destructive copy):
    ```tsx
    "use client";
    import { Ban } from "lucide-react";
    import { toast } from "sonner";
    import {
      AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
      AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
      AlertDialogTitle, AlertDialogTrigger,
    } from "@/components/ui/alert-dialog";
    import { Button } from "@/components/ui/button";
    import { disableUser } from "@/lib/mock/store";
    import { seedUsers } from "@/lib/mock/users";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";

    export function DisableUserButton({
      uid,
      displayName,
      alreadyDisabled,
    }: {
      uid: string;
      displayName: string;
      alreadyDisabled: boolean;
    }) {
      const session = useCurrentUser();
      if (alreadyDisabled) return null;

      function confirm() {
        const actor = session ? seedUsers.find((u) => u.uid === session.uid) : undefined;
        if (!actor) { toast.error("Couldn't disable user"); return; }
        disableUser(uid, actor);
        toast(`${displayName} disabled`);
      }

      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm"><Ban className="mr-2 size-4" />Disable</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disable this user?</AlertDialogTitle>
              <AlertDialogDescription>
                They lose access immediately. Their past activity stays in reports.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirm} className="bg-destructive/10 text-destructive hover:bg-destructive/20">
                Disable user
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }
    ```

    **components/feature/users/InviteUserSheet.tsx** (AUTH-07):
    ```tsx
    "use client";
    import { useState } from "react";
    import { useForm } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { Plus } from "lucide-react";
    import { toast } from "sonner";
    import {
      Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
    } from "@/components/ui/sheet";
    import {
      Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
    } from "@/components/ui/form";
    import { Input } from "@/components/ui/input";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { Button } from "@/components/ui/button";
    import { InviteUserSchema, type InviteUserInput } from "@/lib/schemas/user";
    import { inviteUser } from "@/lib/mock/store";
    import { seedUsers } from "@/lib/mock/users";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";

    export function InviteUserSheet() {
      const [open, setOpen] = useState(false);
      const session = useCurrentUser();
      const form = useForm<InviteUserInput>({
        resolver: zodResolver(InviteUserSchema),
        mode: "onBlur",
        defaultValues: { email: "", displayName: "", role: "staff" },
      });

      if (session?.role !== "admin") return null;

      function onSubmit(values: InviteUserInput) {
        const actor = seedUsers.find((u) => u.uid === session?.uid);
        if (!actor) { toast.error("Couldn't invite user"); return; }
        // Phase 1: store records the user immediately; Phase 2 sends Firebase reset link
        inviteUser(values, actor);
        toast.success("User invited");
        setOpen(false);
        form.reset({ email: "", displayName: "", role: "staff" });
      }

      return (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button><Plus className="mr-2 size-4" />Invite user</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Invite user</SheetTitle>
              <SheetDescription>They&apos;ll receive a sign-in link.</SheetDescription>
            </SheetHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" autoComplete="off" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display name</FormLabel>
                      <FormControl><Input autoComplete="off" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <SheetFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Send invite</Button>
                </SheetFooter>
              </form>
            </Form>
          </SheetContent>
        </Sheet>
      );
    }
    ```

    **components/feature/users/UsersTable.tsx**:
    ```tsx
    "use client";
    import { useMemo } from "react";
    import { Users as UsersIcon, ArrowUpDown } from "lucide-react";
    import type { ColumnDef } from "@tanstack/react-table";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import type { UserDoc } from "@/lib/types/user";
    import { DataTable } from "@/components/feature/table/DataTable";
    import { Button } from "@/components/ui/button";
    import { Badge } from "@/components/ui/badge";
    import { EmptyState } from "@/components/ui/empty-state";
    import { UserRoleSelectInline } from "./UserRoleSelectInline";
    import { DisableUserButton } from "./DisableUserButton";
    import { InviteUserSheet } from "./InviteUserSheet";

    export function UsersTable() {
      const users = useMockStore((s) => s.users);

      const columns: ColumnDef<UserDoc>[] = useMemo(() => [
        {
          accessorKey: "displayName",
          header: ({ column }) => (
            <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
              Name <ArrowUpDown className="ml-2 size-3" />
            </Button>
          ),
          cell: ({ row }) => (
            <div className="flex items-center gap-2">
              <span className="font-medium">{row.original.displayName}</span>
              {row.original.disabled ? <Badge variant="outline" className="text-xs">Disabled</Badge> : null}
            </div>
          ),
        },
        { accessorKey: "email", header: "Email", cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span> },
        {
          accessorKey: "role",
          header: "Role",
          cell: ({ row }) => (
            <UserRoleSelectInline uid={row.original.uid} currentRole={row.original.role} disabled={row.original.disabled} />
          ),
        },
        {
          accessorKey: "createdAt",
          header: "Created",
          cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
        },
        {
          id: "actions",
          header: "",
          cell: ({ row }) => (
            <DisableUserButton
              uid={row.original.uid}
              displayName={row.original.displayName}
              alreadyDisabled={row.original.disabled}
            />
          ),
        },
      ], []);

      return (
        <DataTable<UserDoc>
          columns={columns}
          data={users}
          globalFilterPlaceholder="Search users…"
          toolbarExtras={<InviteUserSheet />}
          emptyState={
            <EmptyState
              icon={UsersIcon}
              heading="Just you, for now"
              body="Invite teammates to check items in and out."
              action={<InviteUserSheet />}
            />
          }
        />
      );
    }
    ```
  </action>
  <verify>
    <automated>ls components/feature/users/UsersTable.tsx components/feature/users/InviteUserSheet.tsx components/feature/users/UserRoleSelectInline.tsx components/feature/users/DisableUserButton.tsx | wc -l | grep -q "^4$"; grep -q "setUserRole" components/feature/users/UserRoleSelectInline.tsx; grep -q "disableUser" components/feature/users/DisableUserButton.tsx; grep -q "Disable this user?" components/feature/users/DisableUserButton.tsx; grep -q "Disable user" components/feature/users/DisableUserButton.tsx; grep -q "inviteUser" components/feature/users/InviteUserSheet.tsx; grep -q "InviteUserSchema" components/feature/users/InviteUserSheet.tsx; grep -q "Just you, for now" components/feature/users/UsersTable.tsx; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - All 4 files exist.
    - DisableUserButton uses EXACT UI-SPEC copy (title "Disable this user?", confirm "Disable user").
    - InviteUserSheet validates via Zod, calls store.inviteUser.
    - UsersTable empty-state uses verbatim UI-SPEC copy: "Just you, for now" / "Invite teammates to check items in and out."
    - tsc passes.
  </acceptance_criteria>
  <done>4 user-management components compile; admin-only by gating in UsersTable + per-component session check.</done>
</task>

<task type="auto">
  <name>Task 2: Users route + Invite route + Settings page + 2 settings cards</name>
  <files>
    app/(app)/users/page.tsx,
    app/(app)/users/invite/page.tsx,
    app/(app)/settings/page.tsx,
    components/feature/settings/ThemePreferencesCard.tsx,
    components/feature/settings/LowStockThresholdsCard.tsx
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-01/01-CONTEXT.md D-07 (admin-only routes including /users, /users/invite)
    - lib/auth/mock-session.ts (requireAdmin)
    - .planning/REQUIREMENTS.md AUTH-07, AUTH-10, RP-01
    - components/ui/page-header.tsx, components/ui/card.tsx
    - next-themes useTheme hook
  </read_first>
  <action>
    **app/(app)/users/page.tsx**:
    ```tsx
    import type { Metadata } from "next";
    import { PageHeader } from "@/components/ui/page-header";
    import { requireAdmin } from "@/lib/auth/mock-session";
    import { UsersTable } from "@/components/feature/users/UsersTable";

    export const metadata: Metadata = { title: "Users" };

    export default async function UsersPage() {
      await requireAdmin();
      return (
        <div className="space-y-6">
          <PageHeader title="Users" description="Manage team members and their access." />
          <UsersTable />
        </div>
      );
    }
    ```

    **app/(app)/users/invite/page.tsx** (full-page form per UI-SPEC; opens the InviteUserSheet on load, or render as a standalone form):

    Per UI-SPEC the invite flow is best as a Sheet (short form). The dedicated `/users/invite` route is required by AUTH-07. We satisfy this by making the route render a "self-opening" version — but since Sheets need user interaction to open programmatically, the simplest Phase 1 implementation is to render a full-page card form duplicating the InviteUserSheet's form:

    ```tsx
    import type { Metadata } from "next";
    import Link from "next/link";
    import { ChevronLeft } from "lucide-react";
    import { PageHeader } from "@/components/ui/page-header";
    import { Button } from "@/components/ui/button";
    import { Card, CardContent } from "@/components/ui/card";
    import { requireAdmin } from "@/lib/auth/mock-session";
    import { InviteUserPageForm } from "./_components/invite-user-page-form";

    export const metadata: Metadata = { title: "Invite user" };

    export default async function InviteUserPage() {
      await requireAdmin();
      return (
        <div className="space-y-4 max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/users"><ChevronLeft className="mr-1 size-4" />Back to users</Link>
          </Button>
          <PageHeader title="Invite user" description="They'll receive a sign-in link." />
          <Card><CardContent className="p-6"><InviteUserPageForm /></CardContent></Card>
        </div>
      );
    }
    ```

    Then create the colocated client form `app/(app)/users/invite/_components/invite-user-page-form.tsx` — same shape as InviteUserSheet's form but as a plain form (no Sheet wrapper):

    ```tsx
    "use client";
    import { useForm } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { useRouter } from "next/navigation";
    import { toast } from "sonner";
    import {
      Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
    } from "@/components/ui/form";
    import { Input } from "@/components/ui/input";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { Button } from "@/components/ui/button";
    import { InviteUserSchema, type InviteUserInput } from "@/lib/schemas/user";
    import { inviteUser } from "@/lib/mock/store";
    import { seedUsers } from "@/lib/mock/users";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";

    export function InviteUserPageForm() {
      const router = useRouter();
      const session = useCurrentUser();
      const form = useForm<InviteUserInput>({
        resolver: zodResolver(InviteUserSchema),
        mode: "onBlur",
        defaultValues: { email: "", displayName: "", role: "staff" },
      });
      function onSubmit(values: InviteUserInput) {
        const actor = session ? seedUsers.find((u) => u.uid === session.uid) : undefined;
        if (!actor) { toast.error("Couldn't invite user"); return; }
        inviteUser(values, actor);
        toast.success("User invited");
        router.push("/users");
      }
      return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="displayName" render={({ field }) => (
              <FormItem><FormLabel>Display name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit">Send invite</Button>
            </div>
          </form>
        </Form>
      );
    }
    ```

    **components/feature/settings/ThemePreferencesCard.tsx**:
    ```tsx
    "use client";
    import { useEffect, useState } from "react";
    import { Sun, Moon, Monitor } from "lucide-react";
    import { useTheme } from "next-themes";
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

    export function ThemePreferencesCard() {
      const { theme, setTheme } = useTheme();
      const [mounted, setMounted] = useState(false);
      useEffect(() => setMounted(true), []);
      return (
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Theme</CardTitle></CardHeader>
          <CardContent>
            <RadioGroup
              value={mounted ? (theme ?? "system") : "system"}
              onValueChange={(v) => setTheme(v)}
              className="grid grid-cols-1 md:grid-cols-3 gap-3"
            >
              {[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ].map((opt) => {
                const Icon = opt.icon;
                return (
                  <label key={opt.value} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer">
                    <RadioGroupItem value={opt.value} />
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                );
              })}
            </RadioGroup>
          </CardContent>
        </Card>
      );
    }
    ```

    **components/feature/settings/LowStockThresholdsCard.tsx** (RP-01):
    ```tsx
    "use client";
    import { useState } from "react";
    import { Save } from "lucide-react";
    import { toast } from "sonner";
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
    import { Input } from "@/components/ui/input";
    import { Button } from "@/components/ui/button";
    import { ScrollArea } from "@/components/ui/scroll-area";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { updateLowStockThreshold } from "@/lib/mock/store";
    import { seedUsers } from "@/lib/mock/users";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";

    export function LowStockThresholdsCard({ isAdmin }: { isAdmin: boolean }) {
      const items = useMockStore((s) => s.items.filter((i) => i.lifecycleState !== "retired"));
      const session = useCurrentUser();
      const [drafts, setDrafts] = useState<Record<string, number>>({});

      function save(itemId: string) {
        const actor = session ? seedUsers.find((u) => u.uid === session.uid) : undefined;
        if (!actor) { toast.error("Couldn't save threshold"); return; }
        const val = drafts[itemId];
        if (val === undefined) return;
        updateLowStockThreshold(itemId, Math.max(0, Math.floor(val)), actor);
        toast.success("Threshold updated");
        setDrafts((d) => { const { [itemId]: _, ...rest } = d; return rest; });
      }

      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Low-stock thresholds</CardTitle>
            <CardDescription>
              {isAdmin
                ? "Set the available-qty threshold below which an item is flagged low-stock."
                : "Only admins can change thresholds."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-80">
              <ul className="divide-y divide-border">
                {items.map((i) => {
                  const current = drafts[i.id] !== undefined ? drafts[i.id] : i.lowStockThreshold;
                  return (
                    <li key={i.id} className="px-6 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{i.name}</p>
                        <p className="text-xs font-mono text-muted-foreground">{i.sku} · {i.availableQty} available</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          className="w-20"
                          value={current}
                          disabled={!isAdmin}
                          onChange={(e) => setDrafts((d) => ({ ...d, [i.id]: Number(e.target.value || 0) }))}
                        />
                        {isAdmin && drafts[i.id] !== undefined && drafts[i.id] !== i.lowStockThreshold ? (
                          <Button size="sm" variant="outline" onClick={() => save(i.id)}><Save className="mr-1 size-3" />Save</Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      );
    }
    ```

    **app/(app)/settings/page.tsx**:
    ```tsx
    import type { Metadata } from "next";
    import { PageHeader } from "@/components/ui/page-header";
    import { getMockSession } from "@/lib/auth/mock-session";
    import { ThemePreferencesCard } from "@/components/feature/settings/ThemePreferencesCard";
    import { LowStockThresholdsCard } from "@/components/feature/settings/LowStockThresholdsCard";

    export const metadata: Metadata = { title: "Settings" };

    export default async function SettingsPage() {
      const session = await getMockSession();
      const isAdmin = session?.role === "admin";
      return (
        <div className="space-y-6 max-w-3xl">
          <PageHeader title="Settings" description="Theme and low-stock thresholds." />
          <ThemePreferencesCard />
          <LowStockThresholdsCard isAdmin={isAdmin} />
        </div>
      );
    }
    ```
  </action>
  <verify>
    <automated>ls app/(app)/users/page.tsx app/(app)/users/invite/page.tsx app/(app)/users/invite/_components/invite-user-page-form.tsx app/(app)/settings/page.tsx components/feature/settings/ThemePreferencesCard.tsx components/feature/settings/LowStockThresholdsCard.tsx | wc -l | grep -q "^6$"; grep -q "requireAdmin" app/(app)/users/page.tsx; grep -q "requireAdmin" app/(app)/users/invite/page.tsx; grep -q "useTheme" components/feature/settings/ThemePreferencesCard.tsx; grep -q "updateLowStockThreshold" components/feature/settings/LowStockThresholdsCard.tsx; grep -q "Just you, for now" components/feature/users/UsersTable.tsx; npx tsc --noEmit; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - All 6 files exist.
    - /users + /users/invite both call requireAdmin().
    - Settings page composes both cards; thresholds editor admin-gated by prop.
    - npm run build passes; tsc passes.
  </acceptance_criteria>
  <done>Users routes + settings page complete with theme + threshold management.</done>
</task>

</tasks>

<verification>
- /users: admin sees list; staff redirects /unauthorized.
- /users/invite: admin only.
- Inline role-select changes propagate to nav (admin loses admin-only items if demoted).
- Disable user adds Disabled badge.
- Settings theme controls work via next-themes.
- Settings low-stock editor admin-only.
- npm run build passes.
</verification>

<success_criteria>AUTH-07, AUTH-08, AUTH-09, AUTH-10, RP-01 satisfied.</success_criteria>

<output>After completion, create `.planning/phases/phase-kayinleong-01/01-12-users-settings-SUMMARY.md` documenting the 9 files and the EVT-08 ↔ allowedStaff recompute that happens automatically when a user is promoted via store.setUserRole.</output>
