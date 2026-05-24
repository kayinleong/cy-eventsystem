import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * StatusBadge — outline pill + colored dot per UI-SPEC Status Palette (Q4).
 *
 * Tone-to-Tailwind mapping is locked to the UI-SPEC table:
 *  - green       → available / planned / active
 *  - blue        → checked_out / in-progress / scan-cart
 *  - amber       → damaged / low-stock / overdue
 *  - muted       → retired / completed / cancelled
 *  - destructive → missing
 *
 * Consumers should call `statusToTone(domainStatus)` to derive the tone instead
 * of passing it directly so the mapping stays centralized.
 */
const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        green: "[&_[data-dot]]:bg-green-500 dark:[&_[data-dot]]:bg-green-400",
        blue: "[&_[data-dot]]:bg-blue-500 dark:[&_[data-dot]]:bg-blue-400",
        amber: "[&_[data-dot]]:bg-amber-500 dark:[&_[data-dot]]:bg-amber-400",
        muted: "[&_[data-dot]]:bg-muted-foreground",
        destructive: "[&_[data-dot]]:bg-destructive",
      },
    },
    defaultVariants: { tone: "muted" },
  },
);

export type StatusTone = NonNullable<
  VariantProps<typeof statusBadgeVariants>["tone"]
>;

export function StatusBadge({
  tone,
  children,
  className,
}: VariantProps<typeof statusBadgeVariants> & {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn(statusBadgeVariants({ tone, className }))}>
      <span data-dot className="size-1.5 rounded-full inline-block" />
      {children}
    </span>
  );
}

export { statusBadgeVariants };
