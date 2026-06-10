// scripts/import-docs/verify.ts
// quick-kayinleong-019 — Read-only verification of the .docs import. Counts the
// imported inventory docs by category, samples one of each source, and HEAD-
// checks a photo URL is reachable. Writes nothing.
//
// Run: tsx --env-file=.env.local scripts/import-docs/verify.ts

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

const app =
  getApps()[0] ??
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId, storageBucket });
const db = getFirestore(app);

async function run() {
  const col = db.collection("inventory");
  const merch = await col.where("category", "==", "Merchandise").count().get();
  const frag = await col.where("category", "==", "Fragrance").count().get();
  const importedBy = await col.where("createdBy", "==", "import-script").count().get();
  console.log("=== Verify import ===");
  console.log(`  Merchandise (B&B):   ${merch.data().count}`);
  console.log(`  Fragrance (Sankito): ${frag.data().count}`);
  console.log(`  createdBy=import-script total: ${importedBy.data().count}`);

  const bb = await col.doc("BB-001").get();
  const sk = await col.doc("186465").get();
  for (const [label, snap] of [["BB-001", bb], ["186465", sk]] as const) {
    if (!snap.exists) {
      console.log(`  ✗ ${label} MISSING`);
      continue;
    }
    const d = snap.data()!;
    console.log(
      `\n  ${label}: name=${d.name} cat=${d.category} brand=${d.brand} qty=${d.totalQty}` +
        ` avail=${d.availableQty} bc=${d.externalBarcode || "-"} loc=${d.location || "-"} life=${d.lifecycleState}`,
    );
    console.log(`     photoUrl: ${d.photoUrl}`);
    if (d.photoUrl) {
      const res = await fetch(d.photoUrl, { method: "HEAD" });
      console.log(`     photo HEAD: ${res.status} ${res.headers.get("content-type")}`);
    }
  }

  // Spot-check a recovered apparel qty + preserved note.
  const jacket = await col.doc("BB-024").get();
  if (jacket.exists) {
    const d = jacket.data()!;
    console.log(`\n  BB-024 (apparel): qty=${d.totalQty} notes=${JSON.stringify(d.notes)}`);
  }
}

run().catch((e) => {
  console.error("Verify failed:", e);
  process.exit(1);
});
