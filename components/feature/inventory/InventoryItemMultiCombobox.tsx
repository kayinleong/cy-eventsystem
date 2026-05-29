// Multi-select inventory item picker — used by the DO upload form.
//
// quick-kayinleong-001: copy of TeamLeadCombobox shape, substituting items
// for users. Retired items are hidden from the picker because they're never
// part of an incoming delivery.

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
import type { InventoryItem } from "@/lib/types/item";
import { cn } from "@/lib/utils";

export function InventoryItemMultiCombobox({
  value,
  onChange,
  items,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  items: InventoryItem[];
}) {
  const [open, setOpen] = useState(false);
  const visibleItems = items.filter((i) => i.lifecycleState !== "retired");

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
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
              ? "Select items…"
              : `${value.length} selected`}
            <ChevronsUpDown className="ml-2 size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search items…" />
            <CommandList>
              <CommandEmpty>No items found.</CommandEmpty>
              <CommandGroup>
                {visibleItems.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.name} ${item.sku} ${item.category}`}
                    onSelect={() => toggle(item.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value.includes(item.id) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm">{item.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {item.sku} · {item.category}
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
          {value.map((id) => {
            const item = visibleItems.find((x) => x.id === id);
            if (!item) return null;
            return (
              <Badge key={id} variant="secondary" className="gap-1">
                {item.name}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${item.name}`}
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
