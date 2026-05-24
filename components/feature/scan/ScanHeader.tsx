// Phase 1 sticky scan-session header.
//
// CONTEXT.md D-15 — once an event is picked (post-scan EventPickerDialog or
// pre-selected via search param), the chosen event sticks across scans until
// the user clicks "End session". Renders nothing when no event is selected
// so the empty /scan state has a clean canvas.
//
// Sticky offset (`top-14`) matches the TopBar height from Plan 04.

"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feature/status/StatusBadge";
import {
  statusToTone,
  statusToLabel,
} from "@/components/feature/status/status-to-tone";

import { useScanSession } from "./scan-session";

export function ScanHeader() {
  const { selectedEvent, endSession } = useScanSession();
  if (!selectedEvent) return null;

  return (
    <div className="sticky top-14 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-2 bg-muted/60 backdrop-blur border-b">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Scanning for</p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">
              {selectedEvent.name}
            </p>
            <StatusBadge tone={statusToTone(selectedEvent.status)}>
              {statusToLabel(selectedEvent.status)}
            </StatusBadge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={endSession}>
          <X className="mr-2 size-4" /> End session
        </Button>
      </div>
    </div>
  );
}
