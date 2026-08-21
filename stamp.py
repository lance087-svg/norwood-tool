#!/usr/bin/env python3
"""
Norwood Supply - build stamper.

Run this from the root of the norwood-tool repo every time you're about to push:

    python3 stamp.py

What it does:
  1. Writes a new build number into version.json (format: YYYYMMDD-HHMM).
  2. Finds every local .js and .css reference in your .html files and sets
     ?v=<build> on it, so browsers are forced to pull the new file.
  3. With --wire, also inserts the <script src="ns-version.js"> line before
     </body> on any page that doesn't have it yet, and adds a build stamp
     line in the footer.

Flags:
  --wire     add the ns-version.js tag + footer stamp to pages missing them
  --dry      show what would change without writing anything
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(".").resolve()
SKIP_DIRS = {".git", "node_modules", "vendor", "lib", "libs", "assets/vendor"}

# Archived / backup / fragment pages - not served to anyone, leave them alone.
SKIP_FILES = {
    "Norwood Pricing Tool 4-11.html",
    "NorwoodSupply_PricingTool_Updated 2.html",
    "NorwoodSupply_PricingTool_Updated.html",
    "NorwoodSupply_PricingTool_Updated_2.html",
    "NorwoodSupply_PricingTool_v3.html",
    "old-delete.html",
    "invoice_redesign_preview_3.html",
    "norwood-scanner-patch.html",
}

DRY = "--dry" in sys.argv
WIRE = "--wire" in sys.argv

build = datetime.now().strftime("%Y%m%d-%H%M")

# Matches src="foo.js" / href="foo.css", with or without an existing ?v=...
ASSET_RE = re.compile(
    r'((?:src|href)\s*=\s*["\'])([^"\'>]+?\.(?:js|css))(\?[^"\']*)?(["\'])',
    re.IGNORECASE,
)

SCRIPT_TAG = '<script src="ns-version.js"></script>'
FOOTER_STAMP = (
    '<div style="text-align:center;font:12px system-ui,sans-serif;'
    'color:#888;padding:8px 0;">build <span data-ns-build>-</span></div>'
)


def is_external(url: str) -> bool:
    u = url.strip().lower()
    return u.startswith(("http://", "https://", "//", "data:"))


def stamp_assets(text: str):
    changes = []

    def repl(m):
        prefix, path, query, quote = m.group(1), m.group(2), m.group(3), m.group(4)
        if is_external(path):
            return m.group(0)
        # Preserve any other query params the file already carries.
        others = ""
        if query:
            parts = [
                p for p in query.lstrip("?").split("&")
                if p and not p.lower().startswith("v=")
            ]
            if parts:
                others = "&" + "&".join(parts)
        changes.append(path)
        return f"{prefix}{path}?v={build}{others}{quote}"

    return ASSET_RE.sub(repl, text), changes


def _insert_before_last_body(text: str, snippet: str):
    """Insert before the LAST </body>. Pages here embed </body> inside JS
    print/PDF template strings, so the first match is often not the real one.
    If there is no </body> at all, append to the end of the file."""
    idx = text.rfind("</body>")
    if idx == -1:
        return text.rstrip() + "\n" + snippet + "\n", True
    return text[:idx] + snippet + "\n" + text[idx:], False


def wire_page(text: str):
    notes = []
    if "data-ns-build" not in text:
        text, appended = _insert_before_last_body(text, "  " + FOOTER_STAMP)
        notes.append("added footer build stamp" + (" (at EOF)" if appended else ""))
    if "ns-version.js" not in text:
        text, appended = _insert_before_last_body(text, "  " + SCRIPT_TAG)
        notes.append("added ns-version.js tag" + (" (at EOF)" if appended else ""))
    return text, notes


def main():
    html_files = [
        p for p in ROOT.rglob("*.html")
        if not any(part in SKIP_DIRS for part in p.parts)
        and p.name not in SKIP_FILES
    ]

    if not html_files:
        print("No .html files found. Are you in the repo root?")
        return 1

    print(f"Build: {build}\n")

    for path in sorted(html_files):
        original = path.read_text(encoding="utf-8")
        text, changed = stamp_assets(original)
        notes = []
        if WIRE:
            text, notes = wire_page(text)

        rel = path.relative_to(ROOT)
        if text == original:
            print(f"  {rel}: no change")
            continue

        detail = []
        if changed:
            detail.append(f"{len(changed)} asset ref(s)")
        detail.extend(notes)
        print(f"  {rel}: {', '.join(detail)}")
        if not DRY:
            path.write_text(text, encoding="utf-8")

    version_path = ROOT / "version.json"
    payload = json.dumps({"build": build}, indent=2) + "\n"
    if not DRY:
        version_path.write_text(payload, encoding="utf-8")
    print(f"\n  version.json -> {build}")

    if DRY:
        print("\n(dry run - nothing written)")
    else:
        print("\nDone. Now commit and push:")
        print(f'  git add -A && git commit -m "build {build}" && git push')
    return 0


if __name__ == "__main__":
    sys.exit(main())
