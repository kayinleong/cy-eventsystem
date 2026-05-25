"use client";
// components/feature/inventory/ItemPhotoField.tsx
// Per D-11 (file + camera), D-12 (compression via uploadItemPhoto helper),
// D-13/D-14 (admin-only storage write, replace-only path), D-15 (UI surface
// amendment — Phase 1 inventory forms shipped without a photo field).
//
// Reuses the ScannerWidget camera permission + tap-to-start pattern. Two
// upload paths: file picker (drag-drop + browse via <input type="file">) and
// 'Take photo' (inline getUserMedia rear-camera capture). After successful
// upload to items/{itemId}/photo.jpg the helper returns the download URL,
// which the parent form submits inside its createItem / updateItem payload.

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ImageIcon, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { uploadItemPhoto } from "@/lib/storage/upload-photo";
import { Button } from "@/components/ui/button";

export function ItemPhotoField({
  itemId,
  initialUrl,
  onChange,
  disabled = false,
}: {
  itemId: string;
  initialUrl: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);

  // Stop the stream on unmount / route change (battery + tab-switch hygiene
  // per ScannerWidget pattern).
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function processAndUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadItemPhoto(itemId, file);
      setPreviewUrl(url);
      onChange(url);
      toast.success("Photo uploaded");
    } catch (err) {
      // Storage rules error (admin-only write per D-13), compression error,
      // or network failure.
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error("Couldn't upload photo", { description: msg });
    } finally {
      setUploading(false);
    }
  }

  async function startCamera() {
    setPermissionError(null);
    try {
      // SCN-02 pattern from ScannerWidget — rear camera default.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      setShowCamera(true);
      // Defer attaching the stream until the <video> element mounts.
      // React schedules the render; we set srcObject in the next effect tick
      // by reading the ref after setState committed.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {
            // Some browsers require a user gesture; surface a hint.
            setPermissionError("Tap the video to start the camera.");
          });
        }
      });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError") {
        // iOS-specific copy mirrors ScannerWidget UI-SPEC error template.
        setPermissionError(
          "Camera access needed. On iOS, open Settings → Safari → Camera and allow this site. Then reload.",
        );
        toast.error("Camera access needed", {
          description: "Allow camera permission in your browser to scan codes.",
        });
      } else if (name === "NotFoundError") {
        setPermissionError("No camera found on this device.");
      } else {
        const msg = err instanceof Error ? err.message : "Camera unavailable";
        setPermissionError(msg);
      }
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  }

  async function snapPhoto() {
    if (!videoRef.current || !streamRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Couldn't capture photo");
      stopCamera();
      return;
    }
    ctx.drawImage(videoRef.current, 0, 0);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.9),
    );
    if (!blob) {
      toast.error("Couldn't capture photo");
      stopCamera();
      return;
    }
    const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
    stopCamera();
    await processAndUpload(file);
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void processAndUpload(file);
    // Reset so re-picking the same file fires onChange.
    e.target.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        {previewUrl ? (
          // Plain <img> for Firebase Storage download URLs — avoids
          // next.config.ts images.remotePatterns plumbing for the dynamic
          // <project>.firebasestorage.app bucket host. Storage rules already
          // gate access to signed-in users (D-13), and the URL itself carries
          // a download token.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="size-32 rounded-md object-cover border"
          />
        ) : (
          <div className="size-32 rounded-md border bg-muted flex items-center justify-center">
            <ImageIcon className="size-8 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">
            JPEG / PNG / WebP. Compressed to ~300KB before upload.
          </p>
        </div>
      </div>

      {showCamera ? (
        <div className="space-y-2">
          <div className="relative aspect-square w-full max-w-md bg-muted rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              onClick={() => videoRef.current?.play().catch(() => undefined)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={snapPhoto} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Camera className="mr-2 size-4" /> Snap
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={stopCamera}>
              <CameraOff className="mr-2 size-4" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFilePick}
            className="hidden"
            disabled={disabled || uploading}
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <ImagePlus className="mr-2 size-4" />
            )}
            Choose file
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || uploading}
            onClick={startCamera}
          >
            <Camera className="mr-2 size-4" /> Take photo
          </Button>
          {previewUrl ? (
            <Button
              type="button"
              variant="ghost"
              disabled={disabled || uploading}
              onClick={() => {
                setPreviewUrl(null);
                onChange(null);
              }}
            >
              Clear photo
            </Button>
          ) : null}
        </div>
      )}

      {permissionError ? (
        <p className="text-sm text-destructive">{permissionError}</p>
      ) : null}
    </div>
  );
}
