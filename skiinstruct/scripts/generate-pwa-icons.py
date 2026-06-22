"""Генерирует PNG-иконки PWA без внешних npm-зависимостей. Запуск: python scripts/generate-pwa-icons.py"""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

PUBLIC = Path(__file__).resolve().parent.parent / "public"
BG = (15, 23, 42)  # #0f172a
FG = (248, 250, 252)  # #f8fafc


def _chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def write_png(path: Path, size: int, pixels: bytes) -> None:
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    raw = b"".join(b"\x00" + pixels[y * size * 4 : (y + 1) * size * 4] for y in range(size))
    compressed = zlib.compress(raw, 9)
    png = b"\x89PNG\r\n\x1a\n" + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", compressed) + _chunk(b"IEND", b"")
    path.write_bytes(png)


def rounded_rect_mask(size: int, radius: int) -> list[list[bool]]:
    mask = [[False] * size for _ in range(size)]
    r = radius
    for y in range(size):
        for x in range(size):
            inside = (
                (r <= x < size - r or (x - r) ** 2 + (y - r) ** 2 <= r * r or (x - (size - r - 1)) ** 2 + (y - r) ** 2 <= r * r)
                and (r <= y < size - r or (x - r) ** 2 + (y - r) ** 2 <= r * r or (x - r) ** 2 + (y - (size - r - 1)) ** 2 <= r * r)
                and (r <= x < size - r or r <= y < size - r or (x - (size - r - 1)) ** 2 + (y - (size - r - 1)) ** 2 <= r * r or (x - r) ** 2 + (y - (size - r - 1)) ** 2 <= r * r or (x - (size - r - 1)) ** 2 + (y - r) ** 2 <= r * r)
            )
            mask[y][x] = inside
    return mask


# Упрощённая маска «скруглённый квадрат» для any-иконки
def icon_mask(size: int) -> list[list[bool]]:
    radius = max(2, size // 8)
    mask = [[False] * size for _ in range(size)]
    for y in range(size):
        for x in range(size):
            cx = min(x, size - 1 - x)
            cy = min(y, size - 1 - y)
            if cx >= radius and cy >= radius:
                mask[y][x] = True
            elif (cx - radius) ** 2 + (cy - radius) ** 2 <= radius * radius:
                mask[y][x] = True
    return mask


# Пиксельная буква U (7x9), масштабируется
U_GLYPH = [
    "1111111",
    "1000001",
    "1000001",
    "1000001",
    "1000001",
    "1000001",
    "1000001",
    "1000001",
    "1111111",
]


def draw_u(pixels: bytearray, size: int, mask: list[list[bool]] | None, scale: float) -> None:
    gw, gh = 7, 9
    cell = max(1, int(size * scale / gh))
    total_w = gw * cell
    total_h = gh * cell
    ox = (size - total_w) // 2
    oy = (size - total_h) // 2 + int(size * 0.04)
    for gy, row in enumerate(U_GLYPH):
        for gx, ch in enumerate(row):
            if ch != "1":
                continue
            for dy in range(cell):
                for dx in range(cell):
                    x = ox + gx * cell + dx
                    y = oy + gy * cell + dy
                    if 0 <= x < size and 0 <= y < size:
                        if mask is None or mask[y][x]:
                            i = (y * size + x) * 4
                            pixels[i : i + 3] = bytes(FG)
                            pixels[i + 3] = 255


def render_icon(size: int, *, maskable: bool) -> bytes:
    pixels = bytearray(size * size * 4)
    if maskable:
        for y in range(size):
            for x in range(size):
                i = (y * size + x) * 4
                pixels[i : i + 3] = bytes(BG)
                pixels[i + 3] = 255
        draw_u(pixels, size, None, 0.55)
    else:
        m = icon_mask(size)
        for y in range(size):
            for x in range(size):
                i = (y * size + x) * 4
                if m[y][x]:
                    pixels[i : i + 3] = bytes(BG)
                    pixels[i + 3] = 255
        draw_u(pixels, size, m, 0.42)
    return bytes(pixels)


def main() -> None:
    outputs = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, False),
    ]
    for name, size, maskable in outputs:
        path = PUBLIC / name
        write_png(path, size, render_icon(size, maskable=maskable))
        print(f"Wrote {name} ({size}x{size})")


if __name__ == "__main__":
    main()
