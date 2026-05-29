// quick-kayinleong-001 — DO file picker with resumable-upload progress.
//
// Generates the doId client-side (caller passes it in) so the storage path
// is fixed before upload starts; mitigates orphan-blob race if the Server
// Action subsequently fails (orphan path is recorded for manual cleanup).

"use client";

import { useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  uploadDeliveryOrderDocument,
  type DoUploadResult,
} from "@/lib/storage/upload-delivery-order";

export type DeliveryOrderUploadFieldProps = {
  doId: string;
  uploaded: (DoUploadResult & { originalFilename: string }) | null;
  onUploaded: (
    result: (DoUploadResult & { originalFilename: string }) | null,
  ) => void;
  disabled?: boolean;
};

export function DeliveryOrderUploadField({
  doId,
  uploaded,
  onUploaded,
  disabled,
}: DeliveryOrderUploadFieldProps) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadDeliveryOrderDocument(doId, file, (p) => {
        const pct = p.totalBytes > 0
          ? Math.round((p.bytesTransferred / p.totalBytes) * 100)
          : 0;
        setProgress(pct);
      });
      onUploaded({ ...result, originalFilename: file.name });
    } catch (err) {
      setError((err as Error).message);
      onUploaded(null);
    } finally {
      setUploading(false);
    }
  }

  if (uploaded) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <div className="flex items-center gap-2 truncate">
          <Paperclip className="size-4 text-muted-foreground shrink-0" />
          <span className="truncate" title={uploaded.originalFilename}>
            {uploaded.originalFilename}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onUploaded(null)}
          aria-label="Remove uploaded file"
          disabled={disabled}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        onChange={handleChange}
        disabled={disabled || uploading}
      />
      {uploading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <Progress value={progress} className="h-2" />
          <span className="tabular-nums">{progress}%</span>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
