#!/usr/bin/env python3
"""
quick-kayinleong-019 — Extract inventory rows + images from the two .docs/
spreadsheets into a manifest the Node importer (import.ts) consumes.

Stdlib only (zipfile / xml / json / urllib / re) — no pip installs.

Sources:
  .docs/Inventory List.xlsx            -> "B&B Inventory" (86 rows, embedded images)
  .docs/KL Autoshow Sankito Stock List.xlsx -> Sankito (23 rows, Google Drive image links)

Output (work dir, git-ignored):
  scripts/import-docs/.work/images/{sku}.{ext}
  scripts/import-docs/.work/manifest.json

Each manifest record matches the createItem() doc shape consumed by import.ts.
Re-running is safe; downloaded Drive images are cached (skipped if already present).
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

# ---- namespaces -------------------------------------------------------------
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
XDR = "{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / ".docs"
WORK = Path(__file__).resolve().parent / ".work"
IMAGES = WORK / "images"

SKU_RE = re.compile(r"^[A-Z0-9-]+$", re.IGNORECASE)


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


# ---- xlsx helpers -----------------------------------------------------------
def shared_strings(z: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    out: list[str] = []
    for si in root.findall(f"{NS}si"):
        out.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
    return out


def col_letter(ref: str) -> str:
    return re.match(r"[A-Z]+", ref).group()


def row_cells(row: ET.Element, ss: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for c in row.findall(f"{NS}c"):
        ref = c.get("r")
        t = c.get("t")
        v = c.find(f"{NS}v")
        isn = c.find(f"{NS}is")
        if t == "s" and v is not None:
            val = ss[int(v.text)]
        elif t == "inlineStr" and isn is not None:
            val = "".join(x.text or "" for x in isn.iter(f"{NS}t"))
        else:
            val = v.text if v is not None else ""
        out[col_letter(ref)] = (val or "").strip()
    return out


def first_sheet(z: zipfile.ZipFile) -> str:
    return sorted(
        n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n)
    )[0]


def coerce_int(raw: str) -> int | None:
    """'7' -> 7, '98.0' -> 98, '9.555904703713E12' -> 9555904703713."""
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        if "e" in raw.lower() or "." in raw:
            return int(round(float(raw)))
        return int(raw)
    except ValueError:
        return None


def img_ext(media_target: str) -> str:
    ext = os.path.splitext(media_target)[1].lstrip(".").lower()
    return "jpg" if ext in ("jpeg", "jpg") else (ext or "jpg")


# ---- B&B (embedded images) --------------------------------------------------
def drawing_anchors(z: zipfile.ZipFile) -> list[tuple[int, str]]:
    """[(excel-row 1-indexed, media archive path)] in document order."""
    rels: dict[str, str] = {}
    rr = ET.fromstring(z.read("xl/drawings/_rels/drawing1.xml.rels"))
    for rel in rr:
        # normalize ../media/imageN.ext -> xl/media/imageN.ext
        rels[rel.get("Id")] = "xl/" + rel.get("Target").replace("../", "")
    d = ET.fromstring(z.read("xl/drawings/drawing1.xml"))
    out: list[tuple[int, str]] = []
    for an in list(d):
        frm = an.find(f"{XDR}from")
        blip = an.find(f".//{A}blip")
        if frm is None or blip is None:
            continue
        row0 = frm.find(f"{XDR}row")
        target = rels.get(blip.get(f"{R}embed"))
        if row0 is not None and target:
            out.append((int(row0.text) + 1, target))
    # Stable sort by anchor row keeps each row's images in document order.
    return sorted(out, key=lambda t: t[0])


def parse_qty(raw: str) -> tuple[int, str, bool]:
    """Returns (qty, note, missing). Plain integers parse directly. Free-text
    cells like 'S - 2, M - 5, L - 18' (apparel size breakdowns), '12 sets', or
    '90+' have their counts recovered and the original text kept as a note so
    nothing is lost. 'missing' is True only for a genuinely empty cell."""
    raw = (raw or "").strip()
    if not raw:
        return 0, "", True
    plain = coerce_int(raw)
    if plain is not None:
        return plain, "", False
    # Sum counts that follow a dash ("<size> - <count>"), e.g. 2XL - 1 -> 1.
    dash_counts = [int(n) for n in re.findall(r"-\s*(\d+)", raw)]
    if dash_counts:
        qty = sum(dash_counts)
    else:
        nums = re.findall(r"\d+", raw)
        qty = int(nums[0]) if nums else 0
    return qty, f"Qty detail: {raw}", False


def extract_bb() -> list[dict]:
    path = DOCS / "Inventory List.xlsx"
    z = zipfile.ZipFile(path)
    ss = shared_strings(z)
    root = ET.fromstring(z.read(first_sheet(z)))
    rows = root.find(f"{NS}sheetData").findall(f"{NS}row")
    anchors = drawing_anchors(z)  # ordered [(row, media), …]

    # First pass — build records (no images yet).
    records: list[dict] = []
    seq = 0
    for r in rows:
        rnum = int(r.get("r"))
        if rnum < 3:  # row 1 = title, row 2 = header
            continue
        c = row_cells(r, ss)
        name = c.get("D", "").strip()
        if not name:
            log(f"  [BB] row {rnum}: empty Description — skipped")
            continue
        seq += 1
        no = coerce_int(c.get("A", "")) or seq
        sku = f"BB-{no:03d}"
        if not SKU_RE.match(sku):
            log(f"  [BB] row {rnum}: bad SKU {sku!r} — skipped")
            continue
        qty, qty_note, missing = parse_qty(c.get("F", ""))
        records.append({
            "source": "bb",
            "sourceRow": rnum,
            "sku": sku,
            "name": name,
            "category": "Merchandise",
            "brand": c.get("E", "").strip(),
            "location": c.get("B", "").strip(),
            "unit": "pcs",
            "totalQty": qty,
            "externalBarcode": "",
            "notes": qty_note,
            "imageFile": None,
            "imageSource": None,
            "qtyMissing": missing,
        })

    # Image assignment. There are exactly as many anchored images as data rows
    # (each product has one photo), but a few images' anchor row landed one row
    # early — so a row shows 2 images and the next shows 0. Because the counts
    # match and both are in row order, assign positionally: i-th image (in
    # anchor order) -> i-th data row. Falls back to per-row first-anchor if the
    # counts ever diverge.
    if len(anchors) == len(records):
        for rec, (_, target) in zip(records, anchors):
            ext = img_ext(target)
            fname = f"{rec['sku']}.{ext}"
            (IMAGES / fname).write_bytes(z.read(target))
            rec["imageFile"] = fname
            rec["imageSource"] = f"embedded:{target}"
    else:
        log(f"  [BB] image/row count mismatch ({len(anchors)} imgs vs {len(records)} rows) — using per-row anchors")
        by_row: dict[int, list[str]] = {}
        for row, target in anchors:
            by_row.setdefault(row, []).append(target)
        for rec in records:
            targets = by_row.get(rec["sourceRow"], [])
            if targets:
                target = targets[0]
                ext = img_ext(target)
                fname = f"{rec['sku']}.{ext}"
                (IMAGES / fname).write_bytes(z.read(target))
                rec["imageFile"] = fname
                rec["imageSource"] = f"embedded:{target}"
    return records


# ---- Sankito (Google Drive links) -------------------------------------------
def sankito_hyperlinks(z: zipfile.ZipFile) -> dict[str, str]:
    """cell ref -> drive url."""
    rels: dict[str, str] = {}
    rr = ET.fromstring(z.read("xl/worksheets/_rels/sheet1.xml.rels"))
    for rel in rr:
        rels[rel.get("Id")] = rel.get("Target")
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    out: dict[str, str] = {}
    for h in sheet.findall(f"{NS}hyperlinks/{NS}hyperlink"):
        out[h.get("ref")] = rels.get(h.get(f"{R}id"), "")
    return out


def drive_id(url: str) -> str | None:
    m = re.search(r"/file/d/([A-Za-z0-9_-]+)", url) or re.search(r"[?&]id=([A-Za-z0-9_-]+)", url)
    return m.group(1) if m else None


def _is_image(p: Path) -> bool:
    if not p.exists() or p.stat().st_size < 100:
        return False
    head = p.read_bytes()[:12]
    return (
        head.startswith(b"\xff\xd8\xff")  # JPEG
        or head.startswith(b"\x89PNG")  # PNG
        or head[:4] == b"RIFF"  # WEBP
        or head.startswith(b"GIF8")  # GIF
    )


def download_drive(file_id: str, dest: Path) -> bool:
    """Fetch a public Drive file via curl (uses macOS system trust store, so it
    sidesteps Python 3.13's missing CA bundle). Detects the large-file
    virus-scan interstitial and retries with the confirm token."""
    if _is_image(dest):
        return True
    url = f"https://drive.google.com/uc?export=download&id={file_id}"
    rc = subprocess.run(
        ["curl", "-fsSL", "-A", "Mozilla/5.0", url, "-o", str(dest)],
        capture_output=True,
    )
    if rc.returncode != 0:
        log(f"  [SANKITO] curl failed for {file_id}: {rc.stderr.decode()[:120]}")
        return False
    if _is_image(dest):
        return True
    # Got an HTML interstitial — look for the confirm token and retry.
    blob = dest.read_bytes()
    m = re.search(rb"confirm=([0-9A-Za-z_-]+)", blob)
    if m:
        token = m.group(1).decode()
        url2 = f"https://drive.google.com/uc?export=download&confirm={token}&id={file_id}"
        subprocess.run(
            ["curl", "-fsSL", "-A", "Mozilla/5.0", url2, "-o", str(dest)],
            capture_output=True,
        )
        if _is_image(dest):
            return True
    log(f"  [SANKITO] non-image response for {file_id}")
    dest.unlink(missing_ok=True)
    return False


def extract_sankito() -> list[dict]:
    path = DOCS / "KL Autoshow Sankito Stock List.xlsx"
    z = zipfile.ZipFile(path)
    ss = shared_strings(z)
    root = ET.fromstring(z.read(first_sheet(z)))
    rows = root.find(f"{NS}sheetData").findall(f"{NS}row")
    links = sankito_hyperlinks(z)

    records: list[dict] = []
    for r in rows:
        rnum = int(r.get("r"))
        if rnum < 2:  # row 1 = header
            continue
        c = row_cells(r, ss)
        name = c.get("B", "").strip()
        if not name:
            continue
        sku_int = coerce_int(c.get("C", ""))
        if sku_int is None:
            log(f"  [SANKITO] row {rnum}: missing SKU Code — skipped")
            continue
        sku = str(sku_int)
        if not SKU_RE.match(sku):
            log(f"  [SANKITO] row {rnum}: bad SKU {sku!r} — skipped")
            continue
        barcode_int = coerce_int(c.get("D", ""))
        barcode = str(barcode_int) if barcode_int is not None else ""
        qty = coerce_int(c.get("I", ""))
        if name.lower().startswith("sankito"):
            brand = "Sankito"
        elif name.lower().startswith("aster"):
            brand = "Aster & Peony"
        else:
            brand = ""
        rec = {
            "source": "sankito",
            "sourceRow": rnum,
            "sku": sku,
            "name": name,
            "category": "Fragrance",
            "brand": brand,
            "location": "",
            "unit": "pcs",
            "totalQty": qty if qty is not None else 0,
            "externalBarcode": barcode,
            "notes": "",
            "imageFile": None,
            "imageSource": None,
            "qtyMissing": qty is None,
            "multiImage": False,
            "barcodeFromNumericCell": barcode != "",
        }
        url = links.get(f"B{rnum}", "")
        fid = drive_id(url)
        if fid:
            fname = f"{sku}.jpg"
            if download_drive(fid, IMAGES / fname):
                rec["imageFile"] = fname
                rec["imageSource"] = f"gdrive:{fid}"
            else:
                rec["imageSource"] = f"gdrive-failed:{fid}"
        records.append(rec)
    return records


def main() -> int:
    IMAGES.mkdir(parents=True, exist_ok=True)
    log("Extracting B&B Inventory…")
    bb = extract_bb()
    log(f"  B&B: {len(bb)} items, {sum(1 for r in bb if r['imageFile'])} with images")
    log("Extracting Sankito (downloading Drive images, may take a moment)…")
    sk = extract_sankito()
    log(f"  Sankito: {len(sk)} items, {sum(1 for r in sk if r['imageFile'])} with images")

    records = bb + sk
    # SKU collision guard within the combined set.
    seen: dict[str, int] = {}
    for r in records:
        seen[r["sku"]] = seen.get(r["sku"], 0) + 1
    dupes = {k: v for k, v in seen.items() if v > 1}
    if dupes:
        log(f"  WARNING: duplicate SKUs across sources: {dupes}")

    manifest = {
        "generatedFrom": ["Inventory List.xlsx", "KL Autoshow Sankito Stock List.xlsx"],
        "count": len(records),
        "imageDir": str(IMAGES),
        "records": records,
    }
    (WORK / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    log(f"\nManifest written: {WORK / 'manifest.json'} ({len(records)} records)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
