// Phase 1 — TeamLeadCombobox.
//
// Multi-select user picker for the EventForm "Team leads" field. Built on
// shadcn `Command` + `Popover` (cmdk-driven typeahead) with selected uids
// rendered as removable `Badge` chips below the trigger.
//
// REQUIREMENTS:
//   - EVT-01 — events have at least one team lead (enforced at schema level by
//     EventFormSchema.teamLeads.min(1)).
//
// Data source: `useMockStore(s => s.users)` — filters out disabled users so an
// event can't be created with a disabled lead. Selected uids are passed in
// from the rhf-controlled value; the combobox is a controlled component.

"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            aria-expanded={open}
          >
            {value.length === 0
              ? "Select team leads…"
              : `${value.length} selected`}
            <ChevronsUpDown className="ml-2 size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search users…" />
            <CommandList>
              <CommandEmpty>No users found.</CommandEmpty>
              <CommandGroup>
                {users.map((u) => (
                  <CommandItem
                    key={u.uid}
                    value={`${u.displayName} ${u.email}`}
                    onSelect={() => toggle(u.uid)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value.includes(u.uid) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm">{u.displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {u.email} · {u.role}
                      </span>
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
                <button
                  type="button"
                  onClick={() => toggle(uid)}
                  aria-label={`Remove ${u.displayName}`}
                >
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
