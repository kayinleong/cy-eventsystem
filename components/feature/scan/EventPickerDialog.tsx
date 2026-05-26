// Phase 2 post-scan event picker dialog.
//
// CONTEXT.md D-15 — opens automatically when /scan has no selected event;
// list is filtered to events the current user can access (EVT-08) and
// constrained to planned + active statuses (CO-02). On selection, the
// dialog closes and the parent caller stashes the chosen event in the
// scan-session sticky header (D-15).
//
// Plan 02-08 swap: the mock "accessible events" selector → useEventsLive
// (Phase 2 onSnapshot hook). EVT-08 access filter happens server-side via
// the array-contains projection inside useEventsLive (admin sees all, staff
// sees only events where uid in allowedStaff). CO-02 status filter is
// applied client-side because useEventsLive's single-status filter doesn't
// accept an array — we subscribe with no status filter and then filter to
// planned + active within the 50-row cursor window.
//
// Built on shadcn Dialog + Command (cmdk-driven typeahead). The Command
// renders the events the user has access to; an empty user (signed out
// edge case) or no-events state renders an empty list.

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useEventsLive } from "@/lib/hooks/use-events-live";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import type { EventDoc } from "@/lib/types/event";

export function EventPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (event: EventDoc) => void;
}) {
  const session = useCurrentUser();
  // useEventsLive requires a Session. While the auth handshake is in flight,
  // session is null — fall back to an empty list (CommandEmpty renders the
  // no-results state). We pass a placeholder session shape only when null
  // so the hook can register a no-op subscription that disposes correctly.
  const liveEvents = useEventsLive(
    [],
    session
      ? { session, limit: 50 }
      : {
          session: {
            uid: "",
            email: "",
            displayName: "",
            role: "staff",
            disabled: false,
          },
          limit: 50,
        },
  );

  // CO-02 — only scannable statuses (planned + active). useEventsLive's
  // status filter accepts a single value; filter client-side within the
  // 50-row cursor window.
  const events = session
    ? liveEvents.filter((e) => e.status === "planned" || e.status === "active")
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pick an event</DialogTitle>
          <DialogDescription>
            Choose the event these items belong to.
          </DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Search events…" autoFocus />
          <CommandList>
            <CommandEmpty>No accessible events.</CommandEmpty>
            <CommandGroup>
              {events.map((e) => (
                <CommandItem
                  key={e.id}
                  value={`${e.name} ${e.location}`}
                  onSelect={() => {
                    onSelect(e);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm">{e.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {e.location} · {e.status}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
