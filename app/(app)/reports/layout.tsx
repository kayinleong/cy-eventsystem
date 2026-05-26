// Phase 2 — Shared layout for all /reports/* pages.
//
// Provides cross-report navigation (tabs) so users can switch between
// Stock / Items out / History / Missing / Repurchase without going back
// through the sidebar (which only links to /reports/stock).
//
// Layout in Next 16 App Router: this file wraps every /reports/* page;
// child pages render where {children} is.

import { ReportsTabs } from "@/components/feature/reports/ReportsTabs";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <ReportsTabs />
      {children}
    </div>
  );
}
