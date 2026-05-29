// quick-kayinleong-001 — admin-only DO list page. Fresh data per nav
// (Server Component reads via Admin SDK); no live updates needed for v1.

import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus, Truck } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";

export const metadata: Metadata = { title: "Delivery Orders" };

type DoRow = {
  id: string;
  vendor: string;
  itemCount: number;
  originalFilename: string;
  fileUrl: string;
  uploadedAt: string | null;
};

function tsToIso(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof ts === "string") return ts;
  return null;
}

async function fetchRecentDeliveryOrders(): Promise<DoRow[]> {
  const snap = await adminDb
    .collection("deliveryOrders")
    .orderBy("uploadedAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      vendor: (data.vendor as string) ?? "",
      itemCount: Array.isArray(data.itemIds) ? data.itemIds.length : 0,
      originalFilename: (data.originalFilename as string) ?? "",
      fileUrl: (data.fileUrl as string) ?? "",
      uploadedAt: tsToIso(data.uploadedAt),
    };
  });
}

export default async function DeliveryOrdersListPage() {
  await requireAdmin();
  const rows = await fetchRecentDeliveryOrders();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Orders"
        description="Vendor delivery records linked to inventory items."
        action={
          <Button asChild>
            <Link href="/delivery-orders/new">
              <Plus className="mr-2 size-4" /> New
            </Link>
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={Truck}
          heading="No delivery orders yet"
          body="Upload a vendor DO to start tracking incoming stock."
          action={
            <Button asChild>
              <Link href="/delivery-orders/new">
                <Plus className="mr-2 size-4" /> New delivery order
              </Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.vendor}</TableCell>
                <TableCell>
                  <a
                    href={r.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm hover:underline"
                  >
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="truncate max-w-[200px]" title={r.originalFilename}>
                      {r.originalFilename || "document"}
                    </span>
                  </a>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.itemCount}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.uploadedAt
                    ? new Date(r.uploadedAt).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/delivery-orders/${r.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
