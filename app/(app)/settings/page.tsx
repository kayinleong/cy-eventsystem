// Phase 1 — /settings page.
//
// REQUIREMENTS:
//   - UI-SPEC sitemap: /settings reachable from sidebar by admin AND staff.
//   - RP-01 — low-stock threshold editor surface (admin-only inside the card).
//   - UI-SPEC "Dark Mode" — theme toggle exists in TopBar (compact); /settings
//     also hosts a richer 3-option radio for parity with the underlying
//     next-themes contract.
//
// Both cards mount; the LowStockThresholdsCard receives `isAdmin` so the
// editor is admin-gated at the input level. Staff see a read-only list of
// items with thresholds (no Save button, inputs disabled, descriptive copy
// explaining the gate). Admins see editable inputs + per-row Save action.
//
// The (app)/layout.tsx role gate (Plan 04) already enforced auth, so
// getMockSession() is safe here — no requireSession() / redirect needed.
// The defensive null-check on session?.role mirrors the dashboard pattern
// (D-01-05-D).

import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { getMockSession } from "@/lib/auth/mock-session";
import { ThemePreferencesCard } from "@/components/feature/settings/ThemePreferencesCard";
import { LowStockThresholdsCard } from "@/components/feature/settings/LowStockThresholdsCard";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await getMockSession();
  const isAdmin = session?.role === "admin";
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Settings"
        description="Theme and low-stock thresholds."
      />
      <ThemePreferencesCard />
      <LowStockThresholdsCard isAdmin={isAdmin} />
    </div>
  );
}
