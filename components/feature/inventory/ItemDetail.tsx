// Phase 1 — Inventory item detail surface.
//
// REQUIREMENTS:
//   - INV-08 — stock breakdown (total / available / out / damaged) + tabs for
//     details and history (chronological per AUD-02)
//   - INV-10 — "Print label" button opens the QR preview dialog
//   - INV-05 — admins see "Retire" + "Edit" actions; staff see only "Print label"
//
// ItemDetail is rendered by /inventory/[itemId]/page.tsx. The page is a
// Server Component that reads the snapshot once for SSR; this client island
// then subscribes to the store via useMockStore inside the History tab so
// later mutations re-render automatically.

import Link from "next/link";
import { Edit, FileText } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/feature/status/StatusBadge";
import {
  statusToTone,
  statusToLabel,
} from "@/components/feature/status/status-to-tone";
import type { InventoryItem } from "@/lib/types/item";
import { AdjustStockDialog } from "./AdjustStockDialog";
import { ItemHistoryTab } from "./ItemHistoryTab";
import { PrintLabelButton } from "./PrintLabelButton";
import { RetireItemButton } from "./RetireItemButton";

export type ItemDetailDeliveryOrder = {
  id: string;
  vendor: string;
  uploadedAt: string | null;
};

export function ItemDetail({
  item,
  isAdmin,
  deliveryOrders = [],
}: {
  item: InventoryItem;
  isAdmin: boolean;
  deliveryOrders?: ItemDetailDeliveryOrder[];
}) {
  const stockCards: { label: string; value: number }[] = [
    { label: "Total", value: item.totalQty },
    { label: "Available", value: item.availableQty },
    { label: "Out", value: item.outQty },
    { label: "Damaged", value: item.damagedQty },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          {item.photoUrl ? (
            // Plain <img> for Firebase Storage download URLs — bucket host
            // is dynamic per project; avoids next.config.ts remotePatterns
            // plumbing. Storage rules gate read to signed-in users (D-13).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.photoUrl}
              alt=""
              className="size-20 rounded-md object-cover border"
            />
          ) : null}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold">{item.name}</h1>
              <StatusBadge tone={statusToTone(item.lifecycleState)}>
                {statusToLabel(item.lifecycleState)}
              </StatusBadge>
            </div>
            <p className="font-mono text-sm text-muted-foreground">{item.sku}</p>
            <p className="text-sm text-muted-foreground">{item.category}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <PrintLabelButton sku={item.sku} name={item.name} />
          {isAdmin ? (
            <Button asChild variant="outline">
              <Link href={`/inventory/${item.id}/edit`}>
                <Edit className="mr-2 size-4" />
                Edit
              </Link>
            </Button>
          ) : null}
          {isAdmin ? (
            <AdjustStockDialog
              itemId={item.id}
              itemName={item.name}
              currentAvailable={item.availableQty}
              currentTotal={item.totalQty}
            />
          ) : null}
          {isAdmin ? (
            <RetireItemButton itemId={item.id} itemName={item.name} />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stockCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="space-y-3 pt-4">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Location</dt>
              <dd>
                {item.location || (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Unit</dt>
              <dd>{item.unit}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Low-stock threshold</dt>
              <dd>{item.lowStockThreshold}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-muted-foreground">Notes</dt>
              <dd>
                {item.notes || (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-muted-foreground">Delivery orders</dt>
              <dd className="mt-1">
                {deliveryOrders.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {deliveryOrders.map((d) => (
                      <Link
                        key={d.id}
                        href={`/delivery-orders/${d.id}`}
                        className="inline-flex"
                      >
                        <Badge
                          variant="secondary"
                          className="gap-2 hover:bg-muted"
                        >
                          <FileText className="size-3" />
                          <span>{d.vendor || "Delivery order"}</span>
                          {d.uploadedAt ? (
                            <span className="text-xs text-muted-foreground">
                              {new Date(d.uploadedAt).toLocaleDateString()}
                            </span>
                          ) : null}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </dd>
            </div>
          </dl>
        </TabsContent>
        <TabsContent value="history" className="pt-4">
          <ItemHistoryTab itemId={item.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
