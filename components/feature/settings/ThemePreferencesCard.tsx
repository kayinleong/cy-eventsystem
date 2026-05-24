// Phase 1 — /settings Theme preferences card.
//
// REQUIREMENTS:
//   - UI-SPEC "Dark Mode" — Manual toggle via `next-themes` in the user menu
//     with options Light/Dark/System (default). Theme attribute: `class` on
//     <html>. /settings hosts a richer 3-option radio variant alongside the
//     compact TopBar toggle (which is already wired in Plan 04).
//
// Hydration safety: next-themes returns `theme` only after client mount. On
// SSR + first paint the radio renders with "system" as a placeholder. The
// `mounted` gate uses useSyncExternalStore (the React 19 canonical pattern
// per D-01-02-A — same shape `useCurrentUser` uses) so we do NOT trigger the
// react-hooks/set-state-in-effect lint rule that useEffect + setState would
// (Plans 02/03/10 all consolidated on this pattern). The subscribe function
// is a no-op because we only need the mount transition; on the server side
// the snapshot is `false` (so we render "system"), on the client it's `true`
// (so we render the persisted `theme` from next-themes).

"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

// SSR-safe mount detector via useSyncExternalStore (D-01-02-A pattern).
// The snapshot is `true` once the client tree mounts (document is defined);
// the server snapshot is always `false`. No subscription is needed because
// the value never changes after the initial mount.
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useHasMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
}

export function ThemePreferencesCard() {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Theme</CardTitle>
        <CardDescription>
          Choose how the app looks. Saved to this device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={mounted ? (theme ?? "system") : "system"}
          onValueChange={(v) => setTheme(v)}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <label
                key={opt.value}
                className="flex items-center gap-3 rounded-md border p-3 cursor-pointer"
              >
                <RadioGroupItem value={opt.value} />
                <Icon className="size-4 text-muted-foreground" />
                <span className="text-sm">{opt.label}</span>
              </label>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
