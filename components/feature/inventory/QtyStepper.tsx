"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * QtyStepper — 44px touch-target +/- quantity stepper.
 *
 * UI-SPEC density exception (WCAG 2.5.5 AAA): the standard 36px button height
 * does NOT meet the 44px minimum touch target required for one-handed mobile
 * scanner use. This component bumps both action buttons to size-11 (44px).
 *
 * Consumers should pass:
 *  - min (default 0): typically the available stock floor
 *  - max (default MAX_SAFE_INTEGER): typically `item.availableQty` or `item.totalQty`
 *
 * The stepper clamps + floors every input internally so the parent never sees
 * a non-integer or out-of-range value.
 */
export function QtyStepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  disabled = false,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.floor(n)));

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        // 44px touch target — UI-SPEC density exception (WCAG 2.5.5 AAA).
        className="size-11 p-0"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" />
      </Button>
      <Input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        className="w-16 text-center font-mono"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(clamp(Number(e.target.value || 0)))}
        aria-label="Quantity"
      />
      <Button
        type="button"
        variant="outline"
        className="size-11 p-0"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
