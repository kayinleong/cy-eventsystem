"use client";
// lib/storage/upload-photo.ts
// Per D-11..D-15: client-side compress + upload to items/{itemId}/photo.jpg.
//
// D-11 — file picker OR camera capture (consumer-side <input> decides).
// D-12 — compress at 0.3MB target / 1600px long edge / quality 0.85.
// D-13 — Storage rules enforce admin-only write + < 5MB + image/* content type.
// D-14 — replace-only lifecycle: same fixed path means each upload overwrites
//        the previous photo. No history, no orphans, no rename plumbing.
//
// Consumer: plan 02-06 inventory forms (/inventory/new + /inventory/[id]/edit).
// Not invoked directly by any Server Action — photoUrl is passed in the
// updateItem / createItem payload by the form after upload completes.

import imageCompression from "browser-image-compression";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/client";

/**
 * Compress (max 1600px long edge / JPEG q=0.85 / target 300KB) and upload
 * to items/{itemId}/photo.jpg via the Web SDK. Returns the public download
 * URL on success.
 *
 * Throws if:
 *  - file is unreadable / not an image (browser-image-compression throws)
 *  - Storage rules reject (admin-only write + size cap + content-type)
 *  - network failure during uploadBytes
 *
 * The caller (form component) should wrap this in try/catch and surface
 * a toast — there's no in-band error result type.
 */
export async function uploadItemPhoto(itemId: string, file: File): Promise<string> {
  // D-12 compression options.
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.85,
  });

  // D-13/D-14 — fixed path; each upload replaces.
  const storageRef = ref(storage, `items/${itemId}/photo.jpg`);
  await uploadBytes(storageRef, compressed, { contentType: "image/jpeg" });
  const url = await getDownloadURL(storageRef);
  return url;
}
