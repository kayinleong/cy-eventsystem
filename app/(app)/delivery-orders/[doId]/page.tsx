// quick-kayinleong-001 — DO detail page. Readable by any signed-in user
// (matches the firestore.rules `allow get, list: if isSignedIn()` for the
// deliveryOrders collection). Shows vendor, file link, item links back to
// inventory, and uploader / timestamp.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import type { DeliveryOrderType } from "@/lib/types/delivery-order";
import { DoTypeBadge } from "@/components/feature/delivery-orders/DoTypeBadge";

type RouteProps = { params: Promise<{ doId: string }> };

type DoDetail = {
  id: string;
  vendor: string;
  fileUrl: string | null;
  originalFilename: string | null;
  contentType: string | null;
  doType: DeliveryOrderType | null;
  sourceType: "manual" | "checkout";
  eventId: string | null;
  itemIds: string[];
  notes: string;
  uploadedAt: string | null;
  uploadedBy: string;
};

type ItemSummary = { id: string; name: string; sku: string; location: string };

function tsToIso(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof ts === "string") return ts;
  return null;
}

async function fetchDeliveryOrder(doId: string): Promise<DoDetail | null> {
  const snap = await adminDb.collection("deliveryOrders").doc(doId).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  return {
    id: snap.id,
    vendor: (data.vendor as string) ?? "",
    fileUrl: (data.fileUrl as string | null) ?? null,
    originalFilename: (data.originalFilename as string | null) ?? null,
    contentType: (data.contentType as string | null) ?? null,
    doType: (data.doType as DeliveryOrderType) ?? null,
    sourceType: (data.sourceType as "manual" | "checkout") ?? "manual",
    eventId: (data.eventId as string | null) ?? null,
    itemIds: Array.isArray(data.itemIds) ? (data.itemIds as string[]) : [],
    notes: (data.notes as string) ?? "",
    uploadedAt: tsToIso(data.uploadedAt),
    uploadedBy: (data.uploadedBy as string) ?? "",
  };
}

async function fetchItemSummaries(itemIds: string[]): Promise<ItemSummary[]> {
  if (itemIds.length === 0) return [];
  const refs = itemIds.map((id) => adminDb.collection("inventory").doc(id));
  const snaps = await adminDb.getAll(...refs);
  return snaps
    .filter((s) => s.exists)
    .map((s) => {
      const d = s.data()!;
      return {
        id: s.id,
        name: (d.name as string) ?? s.id,
        sku: (d.sku as string) ?? s.id,
        location: (d.location as string) ?? "",
      };
    });
}

export async function generateMetadata({
  params,
}: RouteProps): Promise<Metadata> {
  const { doId } = await params;
  const doc = await fetchDeliveryOrder(doId);
  return { title: doc ? `DO: ${doc.vendor}` : "Delivery order not found" };
}

export default async function DeliveryOrderDetailPage({ params }: RouteProps) {
  await requireSession();
  const { doId } = await params;
  const doc = await fetchDeliveryOrder(doId);
  if (!doc) notFound();
  const items = await fetchItemSummaries(doc.itemIds);

  return (
    <div className="space-y-6">
      <PageHeader
        title={doc.vendor}
        description="Delivery order"
        action={
          <Button asChild variant="outline">
            <Link href="/delivery-orders">Back to list</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {doc.fileUrl ? (
              <>
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm hover:underline"
                >
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="truncate" title={doc.originalFilename ?? undefined}>
                    {doc.originalFilename || "Open document"}
                  </span>
                </a>
                <p className="text-xs text-muted-foreground">{doc.contentType}</p>
              </>
            ) : doc.sourceType === "checkout" ? (
              <p className="text-sm text-muted-foreground">
                Auto-generated from checkout
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No document attached
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Uploaded</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              {doc.uploadedAt
                ? new Date(doc.uploadedAt).toLocaleString()
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              by {doc.uploadedBy || "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Type</CardTitle>
          </CardHeader>
          <CardContent>
            {doc.doType ? (
              <DoTypeBadge type={doc.doType} />
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Items ({items.length}
            {items.length !== doc.itemIds.length
              ? ` · ${doc.itemIds.length - items.length} missing`
              : ""}
            )
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No linked items available.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/inventory/${item.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                    {item.location ? (
                      <p className="text-xs text-muted-foreground">
                        {item.location}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {doc.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {doc.notes}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
