// Phase 1 post-scan event picker dialog.
//
// CONTEXT.md D-15 — opens automatically when /scan has no selected event;
// list is filtered to events the current user can access (EVT-08) and
// constrained to planned + active statuses (CO-02). On selection, the
// dialog closes and the parent caller stashes the chosen event in the
// scan-session sticky header (D-15).
//
// Built on shadcn Dialog + Command (cmdk-driven typeahead). The Command
// renders the events the user has access to; an empty user (signed out
// edge case) renders an empty list.

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
import { useMockStore } from "@/lib/hooks/use-mock-store";
import { selectAccessibleEvents } from "@/lib/mock/selectors";
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
  // EVT-08 + CO-02 — filtered to accessible AND planned-or-active.
  const events = useMockStore((s) =>
    session
      ? selectAccessibleEvents(s, session.uid, session.role, [
          "planned",
          "active",
        ])
      : [],
  );

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
