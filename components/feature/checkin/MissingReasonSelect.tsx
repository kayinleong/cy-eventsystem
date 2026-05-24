// Phase 1 — MissingReasonSelect.
//
// shadcn Select wrapping the 4 MissingReason enum values
// ("Lost" | "Damaged" | "Not returned" | "Unknown").
//
// REQUIREMENTS:
//   - CI-04 — when returnedQty < checkedOutQty, the user MUST select a
//     missing-reason from this enum before the line can be committed.
//     The `required` prop drives an `aria-invalid`-style border on the
//     trigger so the inline validation is visible without an extra label.
//   - MIS-01 — the selected reason is recorded on the missingItems doc
//     created inside store.checkin (CheckinLineRow → CheckinForm →
//     store.checkin(eventId, lines, actor) → MissingItemDoc with this
//     reason).
//
// Empty / unset state: the prop value is the empty string `""`. shadcn's
// Select treats `value=""` as "uncontrolled placeholder" — we map it to
// `undefined` on the Radix primitive (the only valid way to show a
// placeholder) and back to `""` on parent state when the user has not
// picked. When required=true and value is empty, the trigger renders
// with a destructive border so the missing-reason gate is visible inline.

"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MissingReason } from "@/lib/types/missing-item";

// REQUIREMENTS.md CI-04 enum — 4 values, locked.
const REASONS: MissingReason[] = ["Lost", "Damaged", "Not returned", "Unknown"];

export function MissingReasonSelect({
  value,
  onChange,
  required = false,
}: {
  value: MissingReason | "";
  onChange: (v: MissingReason | "") => void;
  required?: boolean;
}) {
  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => onChange(v as MissingReason)}
    >
      <SelectTrigger
        className={`w-full ${required && !value ? "border-destructive" : ""}`}
        aria-invalid={required && !value}
      >
        <SelectValue placeholder={required ? "Required" : "—"} />
      </SelectTrigger>
      <SelectContent>
        {REASONS.map((r) => (
          <SelectItem key={r} value={r}>
            {r}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
