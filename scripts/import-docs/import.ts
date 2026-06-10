// scripts/import-docs/import.ts
// quick-kayinleong-019 — Import the .docs spreadsheet manifest (produced by
// extract.py) into the live `inventory` Firestore collection, uploading each
// product image to Storage at items/{sku}/photo.jpg.
//
// Run:
//   npm run import:docs:dry     # validate + report, writes NOTHING (default)
//   npm run import:docs:live    # actually upload images + create inventory docs
//
// Requires FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
// + NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in env (loaded via --env-file=.env.local).
//
// Idempotency: doc id = SKU; existing docs are SKIPPED (never overwritten), so
// the live run is safe to re-run. Writes match the createItem() Server Action
// doc shape (app/(app)/inventory/actions.ts) so imported items are
// indistinguishable from hand-created ones. createdBy/updatedBy = "import-script"
// because a CLI cannot carry an authenticated admin session.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORK = join(HERE, ".work");
const MANIFEST = join(WORK, "manifest.json");
const IMAGES = join(WORK, "images");

const LIVE = process.argv.includes("--live");

const CATEGORIES = new Set([
  "Audio",
  "Lighting",
  "Display",
  "Marketing",
  "Merchandise",
  "Fragrance",
]);
const SKU_RE = /^[A-Z0-9-]+$/i;

type Record = {
  source: string;
  sourceRow: number;
  sku: string;
  name: string;
  category: string;
  brand: string;
  location: string;
  unit: string;
  totalQty: number;
  externalBarcode: string;
  notes: string;
  imageFile: string | null;
  imageSource: string | null;
  qtyMissing?: boolean;
  multiImage?: boolean;
  barcodeFromNumericCell?: boolean;
};

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function loadManifest(): Record[] {
  if (!existsSync(MANIFEST)) {
    fail(`Manifest not found at ${MANIFEST}\nRun: python3 scripts/import-docs/extract.py`);
  }
  const parsed = JSON.parse(readFileSync(MANIFEST, "utf8"));
  return parsed.records as Record[];
}

function validate(r: Record): string[] {
  const errs: string[] = [];
  if (!r.sku || !SKU_RE.test(r.sku)) errs.push(`bad sku ${r.sku}`);
  if (!r.name) errs.push("empty name");
  if (!CATEGORIES.has(r.category)) errs.push(`bad category ${r.category}`);
  if (!Number.isInteger(r.totalQty) || r.totalQty < 0) errs.push(`bad totalQty ${r.totalQty}`);
  if ((r.externalBarcode ?? "").length > 100) errs.push("externalBarcode > 100");
  if ((r.brand ?? "").length > 100) errs.push("brand > 100");
  if ((r.location ?? "").length > 100) errs.push("location > 100");
  if ((r.notes ?? "").length > 2000) errs.push("notes > 2000");
  return errs;
}

function contentTypeFor(file: string): string {
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!projectId || !clientEmail || !rawPrivateKey || !storageBucket) {
    fail(
      "Missing env. Need FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, " +
        "FIREBASE_PRIVATE_KEY, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET (via --env-file=.env.local).",
    );
  }
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");
  const app =
    getApps()[0] ??
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId, storageBucket });
  return { db: getFirestore(app), bucket: getStorage(app).bucket() };
}

async function run() {
  const records = loadManifest();
  console.log(`\n=== Import .docs → inventory (${LIVE ? "LIVE WRITE" : "DRY-RUN — no writes"}) ===`);
  console.log(`Manifest: ${records.length} records  |  images dir: ${IMAGES}`);

  // Validation pass (always).
  const invalid: { sku: string; errs: string[] }[] = [];
  for (const r of records) {
    const errs = validate(r);
    if (errs.length) invalid.push({ sku: r.sku, errs });
  }

  const bySource = (s: string) => records.filter((r) => r.source === s);
  const withImage = records.filter((r) => r.imageFile);
  const noImage = records.filter((r) => !r.imageFile);
  const dlFailed = records.filter((r) => (r.imageSource ?? "").startsWith("gdrive-failed"));
  const multi = records.filter((r) => r.multiImage);
  const qtyMissing = records.filter((r) => r.qtyMissing);

  console.log(`\n  B&B (Merchandise):   ${bySource("bb").length}`);
  console.log(`  Sankito (Fragrance): ${bySource("sankito").length}`);
  console.log(`  with photo:          ${withImage.length}`);
  console.log(`  without photo:       ${noImage.length}` + (noImage.length ? `  (${noImage.map((r) => r.sku).join(", ")})` : ""));
  if (dlFailed.length) console.log(`  ⚠ Drive download FAILED: ${dlFailed.length}  (${dlFailed.map((r) => r.sku).join(", ")})`);
  if (multi.length) console.log(`  note: rows with >1 embedded image (first used): ${multi.map((r) => r.sku).join(", ")}`);
  if (qtyMissing.length) console.log(`  ⚠ qty missing (defaulted 0): ${qtyMissing.map((r) => r.sku).join(", ")}`);
  if (invalid.length) {
    console.log(`\n  ✗ VALIDATION ERRORS (${invalid.length}):`);
    for (const v of invalid) console.log(`     ${v.sku}: ${v.errs.join("; ")}`);
  }

  // Verify local image files actually exist on disk.
  const imgPresent = existsSync(IMAGES) ? new Set(readdirSync(IMAGES)) : new Set<string>();
  const missingOnDisk = withImage.filter((r) => !imgPresent.has(r.imageFile!));
  if (missingOnDisk.length) {
    console.log(`  ⚠ image referenced but missing on disk: ${missingOnDisk.map((r) => r.sku).join(", ")}`);
  }

  console.log("\n  Sample (first 3 per source):");
  for (const s of ["bb", "sankito"]) {
    for (const r of bySource(s).slice(0, 3)) {
      console.log(
        `     [${s}] ${r.sku} | ${r.name} | cat=${r.category} brand=${r.brand || "-"} qty=${r.totalQty}` +
          ` bc=${r.externalBarcode || "-"} loc=${r.location || "-"} img=${r.imageFile ?? "none"}`,
      );
    }
  }

  if (!LIVE) {
    const { db } = initAdmin();
    let exists = 0;
    let toCreate = 0;
    for (const r of records) {
      const snap = await db.collection("inventory").doc(r.sku).get();
      if (snap.exists) exists++;
      else toCreate++;
    }
    console.log(`\n  Against live Firestore: ${toCreate} would be CREATED, ${exists} already exist (skip).`);
    console.log("\nDRY-RUN complete — nothing written. Re-run with --live to import.");
    if (invalid.length) console.log("NOTE: fix validation errors before the live run (invalid records are skipped).");
    return;
  }

  // ---- LIVE write ----
  const { db, bucket } = initAdmin();
  console.log(`\nWriting to bucket: ${bucket.name}\n`);
  let created = 0;
  let skipped = 0;
  let photos = 0;
  let errors = 0;

  for (const r of records) {
    const errs = validate(r);
    if (errs.length) {
      console.log(`  SKIP (invalid) ${r.sku}: ${errs.join("; ")}`);
      errors++;
      continue;
    }
    const ref = db.collection("inventory").doc(r.sku);
    const snap = await ref.get();
    if (snap.exists) {
      skipped++;
      continue;
    }

    let photoUrl: string | null = null;
    if (r.imageFile && imgPresent.has(r.imageFile)) {
      try {
        const path = `items/${r.sku}/photo.jpg`;
        const token = randomUUID();
        const buf = readFileSync(join(IMAGES, r.imageFile));
        const contentType = contentTypeFor(r.imageFile);
        await bucket.file(path).save(buf, {
          resumable: false,
          contentType,
          metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } },
        });
        photoUrl =
          `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
          `${encodeURIComponent(path)}?alt=media&token=${token}`;
        photos++;
      } catch (e) {
        console.log(`  ⚠ photo upload failed for ${r.sku}: ${(e as Error).message}`);
      }
    }

    await ref.set({
      id: r.sku,
      sku: r.sku,
      name: r.name,
      totalQty: r.totalQty,
      availableQty: r.totalQty,
      outQty: 0,
      damagedQty: 0,
      unit: r.unit || "pcs",
      category: r.category,
      location: r.location ?? "",
      brand: r.brand ?? "",
      externalBarcode: r.externalBarcode ?? "",
      notes: r.notes ?? "",
      lifecycleState: "available",
      deliveryOrderIds: [],
      lowStockThreshold: 0,
      lowStockOrderedAt: null,
      photoUrl,
      isLowStock: false, // threshold 0 ⇒ no alert (computeIsLowStock)
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: "import-script",
      updatedBy: "import-script",
    });
    created++;
    if (created % 20 === 0) console.log(`  …${created} created`);
  }

  console.log("\n=== LIVE IMPORT COMPLETE ===");
  console.log(`  created:        ${created}`);
  console.log(`  skipped (exist):${skipped}`);
  console.log(`  photos uploaded:${photos}`);
  console.log(`  invalid skipped:${errors}`);
}

run().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
