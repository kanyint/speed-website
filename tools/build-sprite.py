#!/usr/bin/env python3
"""Builds the inline SVG sprite every page carries: the speed. wordmark letters,
the three strokes (mark, pair, outline), the Lucide icons the site uses and the
channel/social glyphs. It rewrites the block between <!--SPRITE:START--> and
<!--SPRITE:END--> in each HTML file given (default: every .html in the site).

    python3 tools/build-sprite.py            # all pages
    python3 tools/build-sprite.py index.html # one page

Add an icon by adding its Lucide name to ICONS. Lucide is pinned to 0.460.0,
the version the copy deck's icon names were checked against.
"""
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENDOR = Path(__file__).resolve().parent / "vendor"

ICONS = """
inbox filter chart-column file-text percent truck link shield-check credit-card
shopping-cart stethoscope ruler book-open check-check smartphone gauge calculator
file-check messages-square list-checks notebook-pen sparkles reply house
sliders-horizontal palette arrow-right arrow-up-right chevron-down chevron-right
receipt hand-coins package chart-line users mail message-circle phone x search
check ellipsis trending-up message-square-text globe heart-handshake map-pin
""".split()

GLYPHS = "instagram facebook whatsapp messenger telegram tiktok youtube linkedin apple googleplay".split()

# The three strokes, drawn to the brand kit: parallel, rounded ends, rising to
# the right at 32 degrees. Unrotated lines (y, x1, x2) around a centre of (50, 30),
# then turned -32 degrees. The longest is the middle one.
STROKE_W = 9
LINES = [(16, 34, 78), (30, 16, 84), (44, 22, 62)]
CX, CY, ANGLE = 50, 30, -32


def rot(x, y):
    a = math.radians(ANGLE)
    dx, dy = x - CX, y - CY
    return (CX + dx * math.cos(a) - dy * math.sin(a), CY + dx * math.sin(a) + dy * math.cos(a))


def stroke_lines(lines):
    out = []
    for y, x1, x2 in lines:
        (ax, ay), (bx, by) = rot(x1, y), rot(x2, y)
        out.append(f'<line x1="{ax:.2f}" y1="{ay:.2f}" x2="{bx:.2f}" y2="{by:.2f}"/>')
    return "".join(out)


def stroke_outlines(lines):
    out = []
    for y, x1, x2 in lines:
        length = x2 - x1 + STROKE_W
        mx = (x1 + x2) / 2
        cx, cy = rot(mx, y)
        out.append(
            f'<rect x="{cx - length / 2:.2f}" y="{cy - STROKE_W / 2:.2f}" width="{length:.2f}" height="{STROKE_W}" '
            f'rx="{STROKE_W / 2}" transform="rotate({ANGLE} {cx:.2f} {cy:.2f})" vector-effect="non-scaling-stroke"/>'
        )
    return "".join(out)


def wordmark_letters():
    svg = (VENDOR / "Logo-Pri.svg").read_text()
    paths = re.findall(r'<path d="([^"]+)"[^>]*fill="white"', svg)
    return "".join(f'<path d="{d}"/>' for d in paths)


def lucide_symbols():
    nodes = json.loads((VENDOR / "lucide-0.460.0-icon-nodes.json").read_text())
    out = []
    for name in ICONS:
        parts = []
        for tag, attrs in nodes[name]:
            a = " ".join(f'{k}="{v}"' for k, v in attrs.items() if k != "key")
            parts.append(f'<{tag} {a} vector-effect="non-scaling-stroke"/>')
        out.append(f'<symbol id="i-{name}" viewBox="0 0 24 24">{"".join(parts)}</symbol>')
    return "".join(out)


def glyph_symbols():
    out = []
    for name in GLYPHS:
        svg = (VENDOR / "simple-icons" / f"{name}.svg").read_text()
        d = re.search(r'<path d="([^"]+)"', svg).group(1)
        out.append(f'<symbol id="g-{name}" viewBox="0 0 24 24"><path d="{d}"/></symbol>')
    return "".join(out)


def sprite():
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>'
        f'<g id="wm-g">{wordmark_letters()}</g>'
        f'<g id="strokes-g" fill="none" stroke="currentColor" stroke-width="{STROKE_W}" stroke-linecap="round">{stroke_lines(LINES)}</g>'
        f'<g id="strokes-g2" fill="none" stroke="currentColor" stroke-width="{STROKE_W}" stroke-linecap="round">{stroke_lines(LINES[:2])}</g>'
        f'<g id="strokes-outline-g" fill="none" stroke="currentColor" stroke-width="1.5">{stroke_outlines(LINES)}</g>'
        f"{lucide_symbols()}{glyph_symbols()}"
        "</defs></svg>"
    )


def favicon():
    # The three volt strokes on a graphite rounded square (22% corners).
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        '<rect width="100" height="100" rx="22" fill="#1D1D1F"/>'
        '<g transform="translate(12 18) scale(0.76)" fill="none" stroke="#D4F64F" '
        f'stroke-width="{STROKE_W}" stroke-linecap="round">{stroke_lines(LINES)}</g></svg>'
    )


def main(argv):
    files = [ROOT / f for f in argv] if argv else sorted(ROOT.glob("**/*.html"))
    block = sprite()
    for f in files:
        html = f.read_text()
        new, n = re.subn(
            r"<!--SPRITE:START-->.*?<!--SPRITE:END-->",
            lambda _: f"<!--SPRITE:START-->\n{block}\n<!--SPRITE:END-->",
            html,
            flags=re.S,
        )
        if n:
            f.write_text(new)
            print(f"sprite -> {f.relative_to(ROOT)} ({len(block) // 1024} KB)")
    (ROOT / "assets" / "img").mkdir(parents=True, exist_ok=True)
    (ROOT / "assets" / "img" / "favicon.svg").write_text(favicon())


if __name__ == "__main__":
    main(sys.argv[1:])
