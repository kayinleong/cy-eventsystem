import type { LucideIcon } from "lucide-react";

/**
 * UI-SPEC empty-state contract:
 *  - centered vertical stack
 *  - py-16 vertical padding (64px) per spacing scale 3xl
 *  - 24px (size-6) lucide icon in muted-foreground
 *  - 18px heading (text-lg font-semibold) — Heading-M role
 *  - 14px body (text-sm) in muted-foreground
 *  - optional action below
 *
 * Empty-state copy table is in `.planning/phases/phase-kayinleong-01/01-UI-SPEC.md`.
 */
export function EmptyState({
  icon: Icon,
  heading,
  body,
  action,
}: {
  icon: LucideIcon;
  heading: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-16 gap-3">
      <Icon className="size-6 text-muted-foreground" />
      <h2 className="text-lg font-semibold">{heading}</h2>
      <p className="text-sm text-muted-foreground max-w-sm">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
