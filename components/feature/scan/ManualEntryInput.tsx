// Phase 1 manual SKU entry input.
//
// REQUIREMENTS.md SCN-06 + CO-08 + CO-10 — typed SKU fallback for when the
// camera is unavailable, AND the single keystroke handler for Bluetooth
// keyboard-style handheld scanners (CO-10). The Bluetooth-scanner pattern
// works automatically because the device acts like a keyboard: the trigger
// presses Enter at the end of the keystroke burst, which fires submit() here.
//
// The input is always reachable from the /scan page per SCN-06 — the parent
// renders it next to the camera widget unconditionally.

"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ManualEntryInput({
  onSubmit,
  disabled = false,
}: {
  onSubmit: (sku: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // CO-10: Bluetooth scanner keystrokes end with Enter. Same handler
          // as a hand-typed submission.
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Enter SKU or scan barcode…"
        className="font-mono"
        autoComplete="off"
        inputMode="text"
        disabled={disabled}
        aria-label="Manual SKU entry"
      />
      <Button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
      >
        Add
      </Button>
    </div>
  );
}
