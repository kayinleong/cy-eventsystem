// quick-kayinleong-004 — Shared badge for DO type classification.
// Plain function component (no hooks) — importable from both Server and
// Client components.

import { Badge } from "@/components/ui/badge";
import type { DeliveryOrderType } from "@/lib/types/delivery-order";

const DO_TYPE_LABELS: Record<DeliveryOrderType, string> = {
  internal: "Internal",
  "external-outbound": "Outbound",
  "external-inbound": "Inbound",
};

const DO_TYPE_VARIANTS: Record<
  DeliveryOrderType,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  internal: "default",
  "external-outbound": "outline",
  "external-inbound": "secondary",
};

export function DoTypeBadge({ type }: { type: DeliveryOrderType }) {
  return (
    <Badge variant={DO_TYPE_VARIANTS[type]}>{DO_TYPE_LABELS[type]}</Badge>
  );
}
