---
phase: 01-ui-poc
plan: 07
type: execute
wave: 3
depends_on: [01, 02, 03, 04]
files_modified:
  - app/(app)/events/page.tsx
  - app/(app)/events/new/page.tsx
  - app/(app)/events/[eventId]/page.tsx
  - app/(app)/events/[eventId]/edit/page.tsx
  - components/feature/events/EventsTable.tsx
  - components/feature/events/EventForm.tsx
  - components/feature/events/EventDetail.tsx
  - components/feature/events/EventHistoryTab.tsx
  - components/feature/events/EventAssignedItemsTab.tsx
  - components/feature/events/TeamLeadCombobox.tsx
  - components/feature/events/BackupTeamCombobox.tsx
  - components/feature/events/CancelEventDialog.tsx
autonomous: true
requirements:
  - EVT-01
  - EVT-02
  - EVT-03
  - EVT-04
  - EVT-05
  - EVT-06
  - EVT-08
  - AUD-03
  - AUD-04
  - REP-06
  - REP-07
  - NFR-05

must_haves:
  truths:
    - "/events lists accessible events for the current user (admin: all; staff: only events where uid in allowedStaff per EVT-08)."
    - "/events/new admin-or-team-lead-only form creates events via store.createEvent."
    - "/events/[id] renders detail + tabs (Assigned items, History) + status badge + 'Start check-out' (planned) or 'Check in' (active) primary CTA."
    - "/events/[id]/edit admin-only or team-lead-only edit form (EVT-05)."
    - "Cancel event opens AlertDialog with reconciliation modal listing open checkouts and `returned/lost/still_with_owner` selectors per EVT-06."
    - "Date pickers in event form use shadcn calendar via popover."
    - "Multi-select comboboxes for teamLeads and backupTeams using shadcn Command."
    - "Event detail's assigned items tab shows open checkouts from selectOpenCheckoutsForEvent."
    - "Event detail's history tab shows transactions via selectTransactionsForEvent (AUD-03)."
  artifacts:
    - path: "app/(app)/events/page.tsx"
      provides: "Events list with role-aware filtering (admin sees all, staff sees only allowedStaff)"
      contains: "selectAccessibleEvents"
    - path: "app/(app)/events/new/page.tsx"
      provides: "Create event form (admin OR any user — EVT-01 allows team leads too; we keep the new route accessible to all signed-in users in Phase 1 mock, but constrain in Phase 2)"
      contains: "EventForm"
    - path: "app/(app)/events/[eventId]/page.tsx"
      provides: "Event detail (any signed-in user with access to the event)"
      contains: "await params"
    - path: "app/(app)/events/[eventId]/edit/page.tsx"
      provides: "Edit gated by admin OR team-lead per EVT-05"
      contains: "requireSession"
    - path: "components/feature/events/EventForm.tsx"
      provides: "rhf + zodResolver(EventFormSchema) with calendar + comboboxes"
      contains: "EventFormSchema"
    - path: "components/feature/events/CancelEventDialog.tsx"
      provides: "EVT-06 reconciliation dialog"
      contains: "Cancel this event?"
    - path: "components/feature/events/TeamLeadCombobox.tsx"
      provides: "Multi-select user picker for team leads"
      contains: "Command"
  key_links:
    - from: "components/feature/events/EventForm.tsx"
      to: "lib/schemas/event.ts + lib/mock/store.ts (createEvent / updateEvent)"
      via: "rhf submit calls createEvent or updateEvent with actor from useCurrentUser"
      pattern: "createEvent|updateEvent"
    - from: "components/feature/events/CancelEventDialog.tsx"
      to: "lib/mock/store.ts cancelEvent + selectOpenCheckoutsForEvent"
      via: "Iterates open checkouts, collects reconciliation choices, calls cancelEvent"
      pattern: "cancelEvent"
    - from: "app/(app)/events/[eventId]/edit/page.tsx"
      to: "lib/auth/mock-session.ts + EventDoc.teamLeads"
      via: "requireSession + check role === 'admin' OR uid in event.teamLeads, else redirect /unauthorized (EVT-05)"
      pattern: "redirect.*unauthorized"
---

<objective>
Build the full events feature: list, create, detail (with assigned-items + history tabs), edit (admin or team-lead gated), and cancel reconciliation dialog.

Output: 4 route files + 8 feature components.
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
@lib/types/event.ts
@lib/types/user.ts
@lib/schemas/event.ts
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
@components/ui/form.tsx
@components/ui/input.tsx
@components/ui/textarea.tsx
@components/ui/button.tsx
@components/ui/popover.tsx
@components/ui/calendar.tsx
@components/ui/command.tsx
@components/ui/alert-dialog.tsx
@components/ui/select.tsx
@components/feature/status/StatusBadge.tsx
@components/feature/status/status-to-tone.ts
@components/feature/table/DataTable.tsx

<interfaces>
```tsx
export function EventsTable(): React.ReactElement;
export function EventForm(props: { mode: "create" | "edit"; initial?: EventFormInput; eventId?: string }): React.ReactElement;
export function EventDetail(props: { event: EventDoc; isAdmin: boolean; isTeamLead: boolean }): React.ReactElement;
export function EventAssignedItemsTab(props: { eventId: string }): React.ReactElement;
export function EventHistoryTab(props: { eventId: string }): React.ReactElement;
export function TeamLeadCombobox(props: { value: string[]; onChange: (uids: string[]) => void }): React.ReactElement;
export function BackupTeamCombobox(props: { value: string[]; onChange: (uids: string[]) => void; excludeUids?: string[] }): React.ReactElement;
export function CancelEventDialog(props: { eventId: string; eventName: string }): React.ReactElement;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Events list + EventsTable component</name>
  <files>
    app/(app)/events/page.tsx,
    components/feature/events/EventsTable.tsx
  </files>
  <read_first>
    - .planning/REQUIREMENTS.md EVT-03 (sortable by startDate; default filter status=active), EVT-08 (staff access constraint), REP-06, REP-07
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md (Primary CTA: "Create event"; status palette)
    - lib/mock/selectors.ts (selectAccessibleEvents)
    - components/feature/table/DataTable.tsx
  </read_first>
  <action>
    **app/(app)/events/page.tsx**:
    ```tsx
    import type { Metadata } from "next";
    import Link from "next/link";
    import { Plus } from "lucide-react";
    import { PageHeader } from "@/components/ui/page-header";
    import { Button } from "@/components/ui/button";
    import { EventsTable } from "@/components/feature/events/EventsTable";

    export const metadata: Metadata = { title: "Events" };

    export default function EventsListPage() {
      return (
        <div className="space-y-6">
          <PageHeader
            title="Events"
            description="Plan, run, and close out events."
            action={
              <Button asChild>
                <Link href="/events/new"><Plus className="mr-2 size-4" />Create event</Link>
              </Button>
            }
          />
          <EventsTable />
        </div>
      );
    }
    ```

    **components/feature/events/EventsTable.tsx**:
        **D-11 sortable-columns rule (see Plan 03 Task 2):** Sortable columns in this table = `name`, `startDate`, `endDate`, `status`. Non-sortable = `location`, `teamLeads`, `description` (plain string headers, NO toggleSorting/ArrowUpDown). Add `// D-11: <col> is NOT sortable` on each excluded column.

```tsx
    "use client";
    import { useMemo } from "react";
    import Link from "next/link";
    import { Calendar, ArrowUpDown } from "lucide-react";
    import type { ColumnDef } from "@tanstack/react-table";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { useUrlTableState } from "@/lib/hooks/use-url-table-state";
    import { selectAccessibleEvents } from "@/lib/mock/selectors";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";
    import type { EventDoc, EventStatus } from "@/lib/types/event";
    import { DataTable } from "@/components/feature/table/DataTable";
    import { StatusBadge } from "@/components/feature/status/StatusBadge";
    import { statusToTone, statusToLabel } from "@/components/feature/status/status-to-tone";
    import { Button } from "@/components/ui/button";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { EmptyState } from "@/components/ui/empty-state";

    const STATUSES: EventStatus[] = ["planned", "active", "completed", "cancelled"];

    function formatDate(iso: string): string {
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }

    export function EventsTable() {
      const session = useCurrentUser();
      const events = useMockStore((s) =>
        session ? selectAccessibleEvents(s, session.uid, session.role) : []
      );
      const { state: url, setFilter } = useUrlTableState(["status"]);

      const filtered = useMemo(() => {
        // EVT-03 default to active when no status filter specified
        const statusFilter = url.filters.status ?? "active";
        return events.filter((e) => {
          if (statusFilter !== "_all" && e.status !== statusFilter) return false;
          if (url.q) {
            const q = url.q.toLowerCase();
            if (!e.name.toLowerCase().includes(q) && !e.location.toLowerCase().includes(q)) return false;
          }
          return true;
        });
      }, [events, url.filters.status, url.q]);

      const columns: ColumnDef<EventDoc>[] = useMemo(() => [
        {
          accessorKey: "name",
          header: ({ column }) => (
            <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
              Name <ArrowUpDown className="ml-2 size-3" />
            </Button>
          ),
          cell: ({ row }) => (
            <Link href={`/events/${row.original.id}`} className="font-medium hover:underline">
              {row.original.name}
            </Link>
          ),
        },
        {
          accessorKey: "startDate",
          header: ({ column }) => (
            <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
              Start <ArrowUpDown className="ml-2 size-3" />
            </Button>
          ),
          cell: ({ row }) => formatDate(row.original.startDate),
          sortingFn: (a, b) => a.original.startDate.localeCompare(b.original.startDate),
        },
        {
          accessorKey: "endDate",
          header: ({ column }) => (
            <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
              End <ArrowUpDown className="ml-2 size-3" />
            </Button>
          ),
          cell: ({ row }) => formatDate(row.original.endDate),
        },
        {
          accessorKey: "location",
          header: "Location",
        },
        {
          accessorKey: "status",
          header: ({ column }) => (
            <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
              Status <ArrowUpDown className="ml-2 size-3" />
            </Button>
          ),
          cell: ({ row }) => (
            <StatusBadge tone={statusToTone(row.original.status)}>
              {statusToLabel(row.original.status)}
            </StatusBadge>
          ),
        },
      ], []);

      return (
        <DataTable<EventDoc>
          columns={columns}
          data={filtered}
          filterKeys={["status"]}
          globalFilterPlaceholder="Search events…"
          emptyState={
            <EmptyState
              icon={Calendar}
              heading="No events scheduled"
              body="Create an event to begin checking items out."
              action={
                <Button asChild>
                  <Link href="/events/new">Create event</Link>
                </Button>
              }
            />
          }
          toolbarExtras={
            <Select
              value={url.filters.status ?? "active"}
              onValueChange={(v) => setFilter("status", v === "active" ? undefined : v)}
            >
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{statusToLabel(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          }
        />
      );
    }
    ```
  </action>
  <verify>
    <automated>ls app/(app)/events/page.tsx components/feature/events/EventsTable.tsx; grep -q "selectAccessibleEvents" components/feature/events/EventsTable.tsx; grep -q "Create event" components/feature/events/EventsTable.tsx; grep -q "No events scheduled" components/feature/events/EventsTable.tsx; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - Both files exist. Empty-state copy matches UI-SPEC exactly (`No events scheduled` / `Create an event to begin checking items out.`).
    - EventsTable defaults to `status=active` filter (EVT-03).
    - EventsTable uses `selectAccessibleEvents` (EVT-08).
    - tsc passes.
  </acceptance_criteria>
  <done>Events list compiles, status-default-active filter works, role-aware via selectAccessibleEvents.</done>
</task>

<task type="auto">
  <name>Task 2: Team comboboxes + EventForm + new/edit routes</name>
  <files>
    components/feature/events/TeamLeadCombobox.tsx,
    components/feature/events/BackupTeamCombobox.tsx,
    components/feature/events/EventForm.tsx,
    app/(app)/events/new/page.tsx,
    app/(app)/events/[eventId]/edit/page.tsx
  </files>
  <read_first>
    - .planning/phases/phase-kayinleong-01/01-PATTERNS.md "Sign-in form" + "Shared #3 — Form pattern"
    - lib/schemas/event.ts (EventFormSchema)
    - lib/mock/store.ts (createEvent, updateEvent)
    - lib/mock/selectors.ts (selectUserByUid)
    - components/ui/command.tsx (Command, CommandInput, CommandList, CommandItem)
    - components/ui/popover.tsx
    - components/ui/calendar.tsx
    - .planning/REQUIREMENTS.md EVT-01, EVT-05
    - date-fns format function
  </read_first>
  <action>
    **components/feature/events/TeamLeadCombobox.tsx** (multi-select user picker — shadcn Command):
    ```tsx
    "use client";
    import { useState } from "react";
    import { Check, ChevronsUpDown, X } from "lucide-react";
    import { Button } from "@/components/ui/button";
    import {
      Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
    } from "@/components/ui/command";
    import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
    import { Badge } from "@/components/ui/badge";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { cn } from "@/lib/utils";

    export function TeamLeadCombobox({
      value,
      onChange,
    }: {
      value: string[];
      onChange: (uids: string[]) => void;
    }) {
      const [open, setOpen] = useState(false);
      const users = useMockStore((s) => s.users.filter((u) => !u.disabled));

      const toggle = (uid: string) => {
        if (value.includes(uid)) onChange(value.filter((u) => u !== uid));
        else onChange([...value, uid]);
      };

      return (
        <div className="space-y-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between" aria-expanded={open}>
                {value.length === 0 ? "Select team leads…" : `${value.length} selected`}
                <ChevronsUpDown className="ml-2 size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search users…" />
                <CommandList>
                  <CommandEmpty>No users found.</CommandEmpty>
                  <CommandGroup>
                    {users.map((u) => (
                      <CommandItem key={u.uid} value={`${u.displayName} ${u.email}`} onSelect={() => toggle(u.uid)}>
                        <Check className={cn("mr-2 size-4", value.includes(u.uid) ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col">
                          <span className="text-sm">{u.displayName}</span>
                          <span className="text-xs text-muted-foreground">{u.email} · {u.role}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {value.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {value.map((uid) => {
                const u = users.find((x) => x.uid === uid);
                if (!u) return null;
                return (
                  <Badge key={uid} variant="secondary" className="gap-1">
                    {u.displayName}
                    <button type="button" onClick={() => toggle(uid)} aria-label={`Remove ${u.displayName}`}>
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    }
    ```

    **components/feature/events/BackupTeamCombobox.tsx** (same shape; accepts `excludeUids` to prevent overlap with team leads):
    ```tsx
    "use client";
    import { useState } from "react";
    import { Check, ChevronsUpDown, X } from "lucide-react";
    import { Button } from "@/components/ui/button";
    import {
      Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
    } from "@/components/ui/command";
    import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
    import { Badge } from "@/components/ui/badge";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { cn } from "@/lib/utils";

    export function BackupTeamCombobox({
      value,
      onChange,
      excludeUids = [],
    }: {
      value: string[];
      onChange: (uids: string[]) => void;
      excludeUids?: string[];
    }) {
      const [open, setOpen] = useState(false);
      const users = useMockStore((s) =>
        s.users.filter((u) => !u.disabled && !excludeUids.includes(u.uid))
      );
      const toggle = (uid: string) => {
        if (value.includes(uid)) onChange(value.filter((u) => u !== uid));
        else onChange([...value, uid]);
      };
      return (
        <div className="space-y-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between" aria-expanded={open}>
                {value.length === 0 ? "Select backup team (optional)…" : `${value.length} selected`}
                <ChevronsUpDown className="ml-2 size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search users…" />
                <CommandList>
                  <CommandEmpty>No users found.</CommandEmpty>
                  <CommandGroup>
                    {users.map((u) => (
                      <CommandItem key={u.uid} value={`${u.displayName} ${u.email}`} onSelect={() => toggle(u.uid)}>
                        <Check className={cn("mr-2 size-4", value.includes(u.uid) ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col">
                          <span className="text-sm">{u.displayName}</span>
                          <span className="text-xs text-muted-foreground">{u.email} · {u.role}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {value.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {value.map((uid) => {
                const u = users.find((x) => x.uid === uid);
                if (!u) return null;
                return (
                  <Badge key={uid} variant="secondary" className="gap-1">
                    {u.displayName}
                    <button type="button" onClick={() => toggle(uid)} aria-label={`Remove ${u.displayName}`}>
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    }
    ```

    **components/feature/events/EventForm.tsx** (shared by new + edit):
    ```tsx
    "use client";
    import { useForm } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { useRouter } from "next/navigation";
    import { CalendarIcon } from "lucide-react";
    import { format } from "date-fns";
    import { toast } from "sonner";
    import { EventFormSchema, type EventFormInput } from "@/lib/schemas/event";
    import { createEvent, updateEvent } from "@/lib/mock/store";
    import { seedUsers } from "@/lib/mock/users";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";
    import {
      Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
    } from "@/components/ui/form";
    import { Input } from "@/components/ui/input";
    import { Textarea } from "@/components/ui/textarea";
    import { Button } from "@/components/ui/button";
    import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
    import { Calendar } from "@/components/ui/calendar";
    import { TeamLeadCombobox } from "./TeamLeadCombobox";
    import { BackupTeamCombobox } from "./BackupTeamCombobox";
    import { cn } from "@/lib/utils";

    export function EventForm({
      mode,
      initial,
      eventId,
    }: {
      mode: "create" | "edit";
      initial?: EventFormInput;
      eventId?: string;
    }) {
      const router = useRouter();
      const session = useCurrentUser();
      const form = useForm<EventFormInput>({
        resolver: zodResolver(EventFormSchema),
        mode: "onBlur",
        defaultValues: initial ?? {
          name: "", startDate: "", endDate: "", location: "", description: "",
          teamLeads: session ? [session.uid] : [],
          backupTeams: [],
        },
      });

      function onSubmit(values: EventFormInput) {
        const actor = session ? seedUsers.find((u) => u.uid === session.uid) : undefined;
        if (!actor) { toast.error("Couldn't save event"); return; }
        if (mode === "create") {
          const ev = createEvent(values, actor);
          toast.success("Event created");
          router.push(`/events/${ev.id}`);
        } else if (eventId) {
          updateEvent(eventId, values, actor);
          toast.success("Event updated");
          router.push(`/events/${eventId}`);
        }
      }

      const teamLeads = form.watch("teamLeads") ?? [];

      return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Summer Tech Conference" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 size-4" />
                            {field.value ? format(new Date(field.value), "PPP") : "Pick a date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(d) => field.onChange(d ? d.toISOString() : "")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 size-4" />
                            {field.value ? format(new Date(field.value), "PPP") : "Pick a date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(d) => field.onChange(d ? d.toISOString() : "")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl><Input placeholder="Venue or address" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="teamLeads"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team leads</FormLabel>
                  <FormControl>
                    <TeamLeadCombobox value={field.value ?? []} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="backupTeams"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Backup team</FormLabel>
                  <FormControl>
                    <BackupTeamCombobox value={field.value ?? []} onChange={field.onChange} excludeUids={teamLeads} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea rows={4} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit">{mode === "create" ? "Create event" : "Save changes"}</Button>
            </div>
          </form>
        </Form>
      );
    }
    ```

    **app/(app)/events/new/page.tsx** (any signed-in user can attempt create; EVT-01 allows team leads):
    ```tsx
    import type { Metadata } from "next";
    import { PageHeader } from "@/components/ui/page-header";
    import { requireSession } from "@/lib/auth/mock-session";
    import { EventForm } from "@/components/feature/events/EventForm";

    export const metadata: Metadata = { title: "Create event" };

    export default async function NewEventPage() {
      // Phase 1 D-07 lists /events/new as admin-only; we honor that strictness.
      const { redirect } = await import("next/navigation");
      const session = await requireSession();
      if (session.role !== "admin") redirect("/unauthorized");
      return (
        <div className="space-y-6">
          <PageHeader title="Create event" description="Schedule a new event." />
          <EventForm mode="create" />
        </div>
      );
    }
    ```

    Note: D-07 explicitly lists `/events/new` as admin-only in Phase 1. The ROADMAP/REQUIREMENTS allow team leads to create events too (EVT-01), but Phase 1's strict role gate per D-07 keeps it admin-only. Phase 2 may relax this.

    **app/(app)/events/[eventId]/edit/page.tsx** (EVT-05 — admin OR team-lead can edit):
    ```tsx
    import type { Metadata } from "next";
    import { notFound, redirect } from "next/navigation";
    import { PageHeader } from "@/components/ui/page-header";
    import { requireSession } from "@/lib/auth/mock-session";
    import { getSnapshot } from "@/lib/mock/store";
    import { selectEventById } from "@/lib/mock/selectors";
    import { EventForm } from "@/components/feature/events/EventForm";

    export const metadata: Metadata = { title: "Edit event" };

    type RouteProps = { params: Promise<{ eventId: string }> };

    export default async function EditEventPage({ params }: RouteProps) {
      const session = await requireSession();
      const { eventId } = await params;
      const event = selectEventById(getSnapshot(), eventId);
      if (!event) notFound();
      // EVT-05: admin OR event team lead
      const allowed = session.role === "admin" || event.teamLeads.includes(session.uid);
      if (!allowed) redirect("/unauthorized");
      return (
        <div className="space-y-6">
          <PageHeader title="Edit event" description={event.name} />
          <EventForm
            mode="edit"
            eventId={eventId}
            initial={{
              name: event.name,
              startDate: event.startDate,
              endDate: event.endDate,
              location: event.location,
              description: event.description,
              teamLeads: event.teamLeads,
              backupTeams: event.backupTeams,
            }}
          />
        </div>
      );
    }
    ```
  </action>
  <verify>
    <automated>ls components/feature/events/TeamLeadCombobox.tsx components/feature/events/BackupTeamCombobox.tsx components/feature/events/EventForm.tsx app/(app)/events/new/page.tsx app/(app)/events/[eventId]/edit/page.tsx; grep -q "Command" components/feature/events/TeamLeadCombobox.tsx; grep -q "Calendar" components/feature/events/EventForm.tsx; grep -q "createEvent" components/feature/events/EventForm.tsx; grep -q "updateEvent" components/feature/events/EventForm.tsx; grep -q "redirect.*unauthorized" app/(app)/events/new/page.tsx; grep -q "event.teamLeads.includes" app/(app)/events/[eventId]/edit/page.tsx; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - All 5 files exist.
    - Edit route enforces EVT-05: admin OR teamLeads.includes(uid), else redirect /unauthorized.
    - New route enforces D-07 admin-only.
    - Calendar + Command + Popover all wired in EventForm.
    - tsc passes.
  </acceptance_criteria>
  <done>Event form supports calendar pickers + multi-user comboboxes; new + edit role-gated correctly.</done>
</task>

<task type="auto">
  <name>Task 3: Event detail page + assigned items tab + history tab + cancel dialog</name>
  <files>
    app/(app)/events/[eventId]/page.tsx,
    components/feature/events/EventDetail.tsx,
    components/feature/events/EventAssignedItemsTab.tsx,
    components/feature/events/EventHistoryTab.tsx,
    components/feature/events/CancelEventDialog.tsx
  </files>
  <read_first>
    - .planning/REQUIREMENTS.md EVT-02 (status transitions), EVT-04 (assigned items + transaction history), EVT-06 (cancel reconciliation), AUD-03
    - .planning/phases/phase-kayinleong-01/01-UI-SPEC.md destructive confirmation row for "Cancel event"
    - lib/mock/selectors.ts (selectOpenCheckoutsForEvent, selectTransactionsForEvent)
    - lib/mock/store.ts (cancelEvent)
    - components/ui/alert-dialog.tsx, components/ui/select.tsx
  </read_first>
  <action>
    **components/feature/events/EventHistoryTab.tsx**:
    ```tsx
    "use client";
    import Link from "next/link";
    import { Activity } from "lucide-react";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { selectTransactionsForEvent } from "@/lib/mock/selectors";
    import { StatusBadge } from "@/components/feature/status/StatusBadge";
    import { statusToTone, statusToLabel } from "@/components/feature/status/status-to-tone";
    import { EmptyState } from "@/components/ui/empty-state";

    export function EventHistoryTab({ eventId }: { eventId: string }) {
      const txs = useMockStore((s) => selectTransactionsForEvent(s, eventId));
      if (txs.length === 0) {
        return <EmptyState icon={Activity} heading="No activity yet" body="Transactions for this event will appear here." />;
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
                  <span className="font-medium">{t.qty}</span>{" × "}
                  <Link href={`/inventory/${t.itemId}`} className="hover:underline">{t.itemName}</Link>
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

    **components/feature/events/EventAssignedItemsTab.tsx**:
    ```tsx
    "use client";
    import Link from "next/link";
    import { PackageOpen } from "lucide-react";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { selectOpenCheckoutsForEvent } from "@/lib/mock/selectors";
    import { EmptyState } from "@/components/ui/empty-state";

    export function EventAssignedItemsTab({ eventId }: { eventId: string }) {
      const open = useMockStore((s) => selectOpenCheckoutsForEvent(s, eventId));
      if (open.length === 0) {
        return <EmptyState icon={PackageOpen} heading="Nothing checked out" body="Items checked out for this event will appear here." />;
      }
      return (
        <ul className="divide-y divide-border">
          {open.map((t) => (
            <li key={t.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/inventory/${t.itemId}`} className="text-sm font-medium hover:underline">{t.itemName}</Link>
                <p className="text-xs text-muted-foreground font-mono">{t.itemSku}</p>
              </div>
              <span className="text-sm">{t.qty} out</span>
            </li>
          ))}
        </ul>
      );
    }
    ```

    **components/feature/events/CancelEventDialog.tsx** (EVT-06 reconciliation):
    ```tsx
    "use client";
    import { useState } from "react";
    import { useRouter } from "next/navigation";
    import { Ban } from "lucide-react";
    import { toast } from "sonner";
    import {
      AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
      AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
      AlertDialogTrigger,
    } from "@/components/ui/alert-dialog";
    import { Button } from "@/components/ui/button";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { useMockStore } from "@/lib/hooks/use-mock-store";
    import { selectOpenCheckoutsForEvent } from "@/lib/mock/selectors";
    import { cancelEvent } from "@/lib/mock/store";
    import { seedUsers } from "@/lib/mock/users";
    import { useCurrentUser } from "@/lib/hooks/use-current-user";

    type Resolution = "returned" | "lost" | "still_with_owner";

    export function CancelEventDialog({ eventId, eventName }: { eventId: string; eventName: string }) {
      const router = useRouter();
      const session = useCurrentUser();
      const openTxs = useMockStore((s) => selectOpenCheckoutsForEvent(s, eventId));
      const [resolutions, setResolutions] = useState<Record<string, Resolution>>(() => {
        const obj: Record<string, Resolution> = {};
        for (const t of openTxs) obj[t.id] = "returned";
        return obj;
      });

      if (session?.role !== "admin") return null;

      function confirm() {
        const actor = seedUsers.find((u) => u.uid === session?.uid);
        if (!actor) { toast.error("Couldn't cancel event"); return; }
        const reconciliations = openTxs.map((t) => ({
          itemId: t.itemId,
          resolution: resolutions[t.id] ?? "returned",
          qty: t.qty,
        }));
        cancelEvent(eventId, reconciliations, actor);
        toast(`${eventName} cancelled`);
        router.push("/events");
      }

      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive"><Ban className="mr-2 size-4" /> Cancel event</Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this event?</AlertDialogTitle>
              <AlertDialogDescription>
                Items still checked out must be returned manually. The event won&apos;t appear in future schedules.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {openTxs.length > 0 ? (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Reconcile open check-outs ({openTxs.length})
                </p>
                {openTxs.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 border-b pb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.itemName}</p>
                      <p className="text-xs text-muted-foreground">{t.qty} out · <span className="font-mono">{t.itemSku}</span></p>
                    </div>
                    <Select
                      value={resolutions[t.id] ?? "returned"}
                      onValueChange={(v) => setResolutions((r) => ({ ...r, [t.id]: v as Resolution }))}
                    >
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="returned">Returned</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                        <SelectItem value="still_with_owner">Still with owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel>Keep event</AlertDialogCancel>
              <AlertDialogAction onClick={confirm} className="bg-destructive/10 text-destructive hover:bg-destructive/20">
                Cancel event
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }
    ```

    **components/feature/events/EventDetail.tsx**:
    ```tsx
    "use client";
    import Link from "next/link";
    import { Edit, ScanLine, ArrowDownToLine } from "lucide-react";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { Button } from "@/components/ui/button";
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    import { StatusBadge } from "@/components/feature/status/StatusBadge";
    import { statusToTone, statusToLabel } from "@/components/feature/status/status-to-tone";
    import type { EventDoc } from "@/lib/types/event";
    import { EventAssignedItemsTab } from "./EventAssignedItemsTab";
    import { EventHistoryTab } from "./EventHistoryTab";
    import { CancelEventDialog } from "./CancelEventDialog";

    function fmt(iso: string): string {
      return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }

    export function EventDetail({
      event,
      isAdmin,
      canEdit,
    }: {
      event: EventDoc;
      isAdmin: boolean;
      canEdit: boolean;
    }) {
      const primary = event.status === "planned"
        ? { label: "Start check-out", href: `/events/${event.id}/checkout`, icon: ScanLine }
        : event.status === "active"
          ? { label: "Check in", href: `/events/${event.id}/checkin`, icon: ArrowDownToLine }
          : null;

      return (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold">{event.name}</h1>
                <StatusBadge tone={statusToTone(event.status)}>{statusToLabel(event.status)}</StatusBadge>
              </div>
              <p className="text-sm text-muted-foreground">
                {fmt(event.startDate)} – {fmt(event.endDate)} · {event.location || "—"}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {primary ? (
                <Button asChild>
                  <Link href={primary.href}><primary.icon className="mr-2 size-4" />{primary.label}</Link>
                </Button>
              ) : null}
              {canEdit ? (
                <Button asChild variant="outline">
                  <Link href={`/events/${event.id}/edit`}><Edit className="mr-2 size-4" />Edit</Link>
                </Button>
              ) : null}
              {isAdmin && event.status !== "cancelled" && event.status !== "completed" ? (
                <CancelEventDialog eventId={event.id} eventName={event.name} />
              ) : null}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Leads: </span>
                {event.teamLeads.length === 0 ? "—" : event.teamLeads.join(", ")}
              </div>
              <div>
                <span className="text-muted-foreground">Backup: </span>
                {event.backupTeams.length === 0 ? "—" : event.backupTeams.join(", ")}
              </div>
            </CardContent>
          </Card>

          {event.description ? (
            <p className="text-sm text-muted-foreground max-w-3xl whitespace-pre-wrap">{event.description}</p>
          ) : null}

          <Tabs defaultValue="assigned">
            <TabsList>
              <TabsTrigger value="assigned">Assigned items</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="assigned" className="pt-4">
              <EventAssignedItemsTab eventId={event.id} />
            </TabsContent>
            <TabsContent value="history" className="pt-4">
              <EventHistoryTab eventId={event.id} />
            </TabsContent>
          </Tabs>
        </div>
      );
    }
    ```

    **app/(app)/events/[eventId]/page.tsx**:
    ```tsx
    import type { Metadata } from "next";
    import { notFound, redirect } from "next/navigation";
    import { requireSession } from "@/lib/auth/mock-session";
    import { getSnapshot } from "@/lib/mock/store";
    import { selectEventById } from "@/lib/mock/selectors";
    import { EventDetail } from "@/components/feature/events/EventDetail";

    type RouteProps = { params: Promise<{ eventId: string }> };

    export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
      const { eventId } = await params;
      const ev = selectEventById(getSnapshot(), eventId);
      return { title: ev ? ev.name : "Event not found" };
    }

    export default async function EventDetailPage({ params }: RouteProps) {
      const session = await requireSession();
      const { eventId } = await params;
      const event = selectEventById(getSnapshot(), eventId);
      if (!event) notFound();
      // EVT-08: staff only sees events where they're in allowedStaff
      if (session.role !== "admin" && !event.allowedStaff.includes(session.uid)) {
        redirect("/unauthorized");
      }
      const isAdmin = session.role === "admin";
      const canEdit = isAdmin || event.teamLeads.includes(session.uid); // EVT-05
      return <EventDetail event={event} isAdmin={isAdmin} canEdit={canEdit} />;
    }
    ```
  </action>
  <verify>
    <automated>ls app/(app)/events/[eventId]/page.tsx components/feature/events/EventDetail.tsx components/feature/events/EventAssignedItemsTab.tsx components/feature/events/EventHistoryTab.tsx components/feature/events/CancelEventDialog.tsx | wc -l | grep -q "^5$"; grep -q "await params" app/(app)/events/[eventId]/page.tsx; grep -q "allowedStaff.includes" app/(app)/events/[eventId]/page.tsx; grep -q "Cancel this event" components/feature/events/CancelEventDialog.tsx; grep -q "Cancel event" components/feature/events/CancelEventDialog.tsx; grep -q "selectOpenCheckoutsForEvent" components/feature/events/CancelEventDialog.tsx; grep -q "cancelEvent" components/feature/events/CancelEventDialog.tsx; grep -q "selectTransactionsForEvent" components/feature/events/EventHistoryTab.tsx; npx tsc --noEmit; npm run build</automated>
  </verify>
  <acceptance_criteria>
    - All 5 files exist.
    - Detail route enforces EVT-08 (staff redirects to /unauthorized if not in allowedStaff).
    - CancelEventDialog uses EXACT UI-SPEC copy ("Cancel this event?" title; "Cancel event" confirm).
    - CancelEventDialog enumerates open checkouts via selectOpenCheckoutsForEvent and collects reconciliation choices.
    - History tab renders via selectTransactionsForEvent (AUD-03).
    - npx tsc --noEmit + npm run build pass.
  </acceptance_criteria>
  <done>Event detail with tabs + cancel reconciliation works, role-aware access enforced, build passes.</done>
</task>

</tasks>

<verification>
- /events: lists role-filtered events with status filter defaulting to active.
- /events/new: admin-only.
- /events/[id]: status badge, primary CTA dynamic on status, edit gated by admin or team-lead, cancel admin-only with reconciliation modal.
- Calendar pickers and multi-user comboboxes both work.
- npm run build passes.
</verification>

<success_criteria>EVT-01..06, EVT-08, AUD-03, AUD-04 satisfied at UI level.</success_criteria>

<output>After completion, create `.planning/phases/phase-kayinleong-01/01-07-events-SUMMARY.md` documenting the 12 files created and the role gating decisions.</output>
