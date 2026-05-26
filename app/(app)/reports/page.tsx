// Phase 2 — /reports index. Redirects to the first report tab so the
// bare URL works without requiring users to know the sub-paths.

import { redirect } from "next/navigation";

export default function ReportsIndexPage() {
  redirect("/reports/stock");
}
