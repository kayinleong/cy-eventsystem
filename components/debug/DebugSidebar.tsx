"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { clearAllDataAction } from "@/app/(app)/debug/actions";

// Trigger: press 'e' 5 times within 1.5 s (ignored when focus is on an input).
const TRIGGER_KEY = "e";
const TRIGGER_COUNT = 5;
const TRIGGER_WINDOW_MS = 1500;

export function DebugSidebar() {
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const countRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if (e.key.toLowerCase() !== TRIGGER_KEY) return;

      countRef.current += 1;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        countRef.current = 0;
      }, TRIGGER_WINDOW_MS);

      if (countRef.current >= TRIGGER_COUNT) {
        countRef.current = 0;
        if (timerRef.current) clearTimeout(timerRef.current);
        setOpen(true);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleClear() {
    setClearing(true);
    const result = await clearAllDataAction();
    setClearing(false);
    if (result.ok) {
      toast.success("All data cleared", {
        description: "Inventory, events, transactions, DOs, groups and missing items deleted. Users preserved.",
      });
      setOpen(false);
    } else {
      toast.error("Clear failed", { description: result.error });
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>Debug Panel</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-destructive">Danger Zone</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Permanently deletes all inventory, events, transactions, delivery
              orders, checkout groups and missing-item records. User accounts are
              preserved. This cannot be undone.
            </p>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  disabled={clearing}
                >
                  <Trash2 className="mr-2 size-4" />
                  Clear All Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes all inventory, events, transactions,
                    delivery orders, checkout groups and missing-item records.
                    User accounts are preserved. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={clearing}
                    onClick={handleClear}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {clearing ? "Clearing…" : "Yes, clear everything"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
