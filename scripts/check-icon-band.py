#!/usr/bin/env python3
"""Fail the build if the launcher icon's artwork can be cropped away.

The Vega launcher scales the 512x512 icon to fill a 3:2 tile (~304x200)
and crops top and bottom: only the band y=100..412 survives (measured on
the Virtual Device, fortemate/dicechess-tv FL-16). Side margins of 51px
keep artwork clear of the tile edges.

Pattern stolen from dicechess-tv native/test/splash.test.ts:
background = bilinear interpolation of the four corners; a pixel more
than 24/255 away from it is artwork, whatever its colour.
"""
import sys
from pathlib import Path

from PIL import Image

BAND_TOP, BAND_BOTTOM = 100, 412
SIDE_MARGIN = 51
THRESHOLD = 24

ICON = Path(__file__).resolve().parent.parent / "app" / "assets" / "image" / "icon.png"


def main() -> int:
    img = Image.open(ICON).convert("RGBA")
    w, h = img.size
    if (w, h) != (512, 512):
        print(f"FAIL: icon is {w}x{h}, must be 512x512")
        return 1

    px = img.load()
    # Opaque everywhere: a transparent icon came out distorted in the launcher.
    for y in range(h):
        for x in range(w):
            if px[x, y][3] != 255:
                print(f"FAIL: transparent pixel at {x},{y} — icon must be opaque")
                return 1

    def rgb(x, y):
        r, g, b, _ = px[x, y]
        return (r, g, b)

    c00 = rgb(0, 0)
    c10 = rgb(w - 1, 0)
    c01 = rgb(0, h - 1)
    c11 = rgb(w - 1, h - 1)

    strays = []
    artwork = 0
    for y in range(h):
        v = y / (h - 1)
        for x in range(w):
            u = x / (w - 1)
            r, g, b = rgb(x, y)
            off = max(
                abs(r - (c00[0] * (1 - u) * (1 - v) + c10[0] * u * (1 - v) + c01[0] * (1 - u) * v + c11[0] * u * v)),
                abs(g - (c00[1] * (1 - u) * (1 - v) + c10[1] * u * (1 - v) + c01[1] * (1 - u) * v + c11[1] * u * v)),
                abs(b - (c00[2] * (1 - u) * (1 - v) + c10[2] * u * (1 - v) + c01[2] * (1 - u) * v + c11[2] * u * v)),
            )
            if off <= THRESHOLD:
                continue
            artwork += 1
            if not (BAND_TOP <= y < BAND_BOTTOM and SIDE_MARGIN <= x < w - SIDE_MARGIN):
                strays.append(f"{x},{y}")

    if strays:
        print(
            f"FAIL: {len(strays)} artwork pixels outside the launcher band "
            f"(y {BAND_TOP}-{BAND_BOTTOM}, x {SIDE_MARGIN}-{w - SIDE_MARGIN}); "
            f"first at {strays[0]}"
        )
        return 1
    if artwork < 10000:
        print(f"FAIL: only {artwork} artwork pixels — is this the icon?")
        return 1
    print(f"OK: icon 512x512 opaque, {artwork} artwork pixels all inside the launcher band")
    return 0


if __name__ == "__main__":
    sys.exit(main())
