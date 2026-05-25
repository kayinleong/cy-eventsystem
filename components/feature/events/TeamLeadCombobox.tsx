// Phase 2 — TeamLeadCombobox (Block D UI swap, plan 02-07).
//
// Multi-select user picker for the EventForm "Team leads" field. Built on
// shadcn `Command` + `Popover` (cmdk-driven typeahead) with selected uids
// rendered as removable `Badge` chips below the trigger.
//
// REQUIREMENTS:
//   - EVT-01 — events have at least one team lead (enforced at schema level by
//     EventFormSchema.teamLeads.min(1)).
//
// Phase 2 swap: the combobox now receives `users` as a prop from the
// EventForm parent (which receives it from the SSR seed in /events/new and
// /events/[id]/edit). This removes the mock-store dependency without
// changing the visual contract.

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
import type { UserDoc } from "@/lib/types/user";
import { cn } from "@/lib/utils";

export function TeamLeadCombobox({
  value,
  onChange,
  users,
}: {
  value: string[];
  onChange: (uids: string[]) => void;
  users: UserDoc[];
}) {
  const [open, setOpen] = useState(false);
  const enabledUsers = users.filter((u) => !u.disabled);

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
                {enabledUsers.map((u) => (
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
            const u = enabledUsers.find((x) => x.uid === uid);
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
