#!/usr/bin/env python3
"""Extract & compress MBA Pathshala lecture frames from the source PDFs into
public/mba-pathshala/<slug>/qNN.jpg and write a manifest.json the app reads.

The raw PDFs (multi-GB) are NOT committed. Only the compressed web images are.
Re-run after replacing the PDFs in .rawpdf/:  python3 scripts/extract_mba_images.py
"""
import fitz, os, json, re, sys

SRC = ".rawpdf"
OUT = "public/mba-pathshala"

# Stable slugs so the app's static metadata (src/data/mbaPathshala.js) can map to folders.
SLUGS = {
    "Compound Interest": "compound-interest",
    "Logarithms": "logarithms",
    "Ratio and Proportion": "ratio-proportion",
    "Time And Work CAT": "time-work",
    "Linear Equations": "linear-equations",
    "Arithmetic and Geometric Progression": "ap-gp",
    "Percentages": "percentages",
    "Time Speed Distance": "time-speed-distance",
    "Surds and Indices": "surds-indices",
    "Simple Interest": "simple-interest",
    "Profit, Loss and Discount": "profit-loss-discount",
    "Mixtures and Alligations": "mixtures-alligations",
    "Quadratic Equation": "quadratic-equations",
    "Averages": "averages",
}

def slugify(name):
    return SLUGS.get(name, re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"))

def process(pdf_path):
    name = os.path.splitext(os.path.basename(pdf_path))[0]
    slug = slugify(name)
    dest = os.path.join(OUT, slug)
    os.makedirs(dest, exist_ok=True)
    for f in os.listdir(dest):
        if f.endswith(".jpg"):
            os.remove(os.path.join(dest, f))
    doc = fitz.open(pdf_path)
    seen = set()
    files = []
    total = 0
    for pno in range(doc.page_count):
        page = doc[pno]
        info = sorted(page.get_image_info(xrefs=True), key=lambda d: d.get("bbox", [0, 0, 0, 0])[1])
        for im in info:
            xref = im.get("xref", 0)
            if not xref or xref in seen:
                continue
            seen.add(xref)
            try:
                pix = fitz.Pixmap(doc, xref)
            except Exception:
                continue
            if pix.width < 400 or pix.height < 300:
                continue
            if pix.alpha:
                pix = fitz.Pixmap(pix, 0)
            if pix.n >= 4:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            pix.shrink(1)  # halve longest edge (~3024 -> ~1512px), keeps handwriting legible
            jpg = pix.tobytes(output="jpeg", jpg_quality=66)
            fname = f"q{len(files) + 1:03d}.jpg"
            with open(os.path.join(dest, fname), "wb") as fh:
                fh.write(jpg)
            files.append(fname)
            total += len(jpg)
    doc.close()
    print(f"  {name:42s} -> {slug:22s} {len(files):3d} imgs  {total/1024/1024:5.1f}MB")
    return slug, name, files, total

def main():
    if not os.path.isdir(SRC):
        print(f"Source dir {SRC}/ not found. Extract the zip there first.")
        sys.exit(1)
    os.makedirs(OUT, exist_ok=True)
    pdfs = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".pdf"))
    manifest = {}
    grand = 0
    count = 0
    for p in pdfs:
        slug, name, files, total = process(os.path.join(SRC, p))
        manifest[slug] = {"name": name, "count": len(files), "images": files}
        grand += total
        count += len(files)
    with open(os.path.join(OUT, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=0)
    print(f"\nTOTAL: {count} images, {grand/1024/1024:.1f}MB across {len(pdfs)} topics")
    print(f"Manifest: {OUT}/manifest.json")

if __name__ == "__main__":
    main()
