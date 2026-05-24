// Phase 1 — BackupTeamCombobox.
//
// Multi-select user picker for the EventForm "Backup team" field. Same shape
// as `TeamLeadCombobox` but accepts an `excludeUids` prop so users already
// selected as team leads don't appear in the picker.
//
// REQUIREMENTS:
//   - Backup team support per event (project-level requirement — see
//     PROJECT.md user clarifications: "Backup team support per event").
//   - allowedStaff = teamLeads + backupTeams + admins (computed by the store
//     mutator, not here — see lib/mock/store.ts createEvent/updateEvent).

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
  // Pull ALL non-disabled users for chip rendering; filter excludeUids only
  // for the picker options so a previously-selected backup user whose uid is
  // now excluded (e.g. they were promoted to a team lead in the same form)
  // still renders as a removable chip.
  const allUsers = useMockStore((s) => s.users.filter((u) => !u.disabled));
  const pickerUsers = allUsers.filter((u) => !excludeUids.includes(u.uid));

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
              ? "Select backup team (optional)…"
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
                {pickerUsers.map((u) => (
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
            const u = allUsers.find((x) => x.uid === uid);
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
