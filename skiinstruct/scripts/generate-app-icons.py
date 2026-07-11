"""Generate home-screen / PWA icons from the current brand mark."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public"
SRC = ROOT / "brand" / "press" / "logo-mark-transparent.png"


def make_icon(
    size: int,
    pad_ratio: float,
    bg: tuple[int, int, int, int] = (255, 255, 255, 255),
    out: Path | None = None,
) -> Image.Image:
    src = Image.open(SRC).convert("RGBA")
    canvas = Image.new("RGBA", (size, size), bg)
    inner = int(size * (1 - 2 * pad_ratio))
    ratio = src.width / src.height
    if ratio < 1:
        h = inner
        w = max(1, int(inner * ratio))
    else:
        w = inner
        h = max(1, int(inner / ratio))
    logo = src.resize((w, h), Image.Resampling.LANCZOS)
    x = (size - w) // 2
    y = (size - h) // 2
    canvas.alpha_composite(logo, (x, y))
    if bg[3] == 255:
        flat = Image.new("RGB", (size, size), bg[:3])
        flat.paste(canvas, mask=canvas.split()[3])
        result: Image.Image = flat
    else:
        result = canvas
    if out is not None:
        result.save(out, "PNG", optimize=True)
        print(f"wrote {out.name} {result.size} {result.mode}")
    return result


def main() -> None:
    make_icon(180, 0.14, out=ROOT / "apple-touch-icon.png")
    make_icon(192, 0.14, out=ROOT / "icon-192.png")
    make_icon(512, 0.14, out=ROOT / "icon-512.png")
    # Android adaptive / maskable: keep logo inside safe zone
    make_icon(512, 0.22, out=ROOT / "icon-maskable-512.png")
    make_icon(48, 0.12, out=ROOT / "favicon-48.png")
    print("done")


if __name__ == "__main__":
    main()
