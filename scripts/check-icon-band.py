#!/usr/bin/env python3
"""Fail the build if launcher-icon artwork leaves the Vega safe band.

Stolen pattern: fortemate/dicechess-tv native/test/splash.test.ts (FL-16).
The Vega launcher scales the 512px icon to fill a 3:2 tile (~304x200) and
crops top/bottom — only y=100..412 survives, with 51px side margins.
Anything but background outside that band gets decapitated on the stick.

Usage: python3 scripts/check-icon-band.py [path/to/icon.png]
Exit 0 = pass, 1 = fail (with the offending pixel locations).
"""
import sys
from PIL import Image

BAND_TOP, BAND_BOTTOM, BAND_SIDE = 100, 412, 51
SIZE = 512
ARTWORK_THRESHOLD = 24  # max channel distance from background
MIN_ARTWORK_PIXELS = 10000  # sanity: is this actually an icon?


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "assets/image/icon.png"
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    if (w, h) != (SIZE, SIZE):
        print(f"FAIL: icon is {w}x{h}, must be {SIZE}x{SIZE}")
        return 1
    px = img.load()

    # Opaque everywhere: transparency distorts in the launcher (FL-16).
    for y in (0, h - 1):
        for x in (0, w - 1):
            if px[x, y][3] != 255:
                print(f"FAIL: transparent pixel at {x},{y}")
                return 1

    # Background = bilinear blend of the four corners (flat fill or
    # straight gradient reproduced exactly, per dicechess-tv).
    corners = [px[0, 0][:3], px[w - 1, 0][:3], px[0, h - 1][:3], px[w - 1, h - 1][:3]]

    def bg(x: int, y: int):
        u, v = x / (w - 1), y / (h - 1)
        return tuple(
            corners[0][i] * (1 - u) * (1 - v)
            + corners[1][i] * u * (1 - v)
            + corners[2][i] * (1 - u) * v
            + corners[3][i] * u * v
            for i in range(3)
        )

    artwork = 0
    strays: list[str] = []
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            br, bg_, bb = bg(x, y)
            if max(abs(r - br), abs(g - bg_), abs(b - bb)) <= ARTWORK_THRESHOLD:
                continue
            artwork += 1
            in_band = (
                BAND_TOP <= y < BAND_BOTTOM
                and BAND_SIDE <= x < w - BAND_SIDE
            )
            if not in_band:
                if len(strays) < 5:
                    strays.append(f"{x},{y}")

    if strays:
        print(
            f"FAIL: artwork pixels outside the launcher band "
            f"(y {BAND_TOP}-{BAND_BOTTOM}, x {BAND_SIDE}-{w - BAND_SIDE}); "
            f"first at {strays[0]} (showing up to 5: {strays})"
        )
        return 1
    if artwork < MIN_ARTWORK_PIXELS:
        print(f"FAIL: only {artwork} artwork pixels — is this the icon?")
        return 1
    print(
        f"PASS: {artwork} artwork pixels, all inside "
        f"y[{BAND_TOP},{BAND_BOTTOM}) x[{BAND_SIDE},{w - BAND_SIDE})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
