// QR rendering (spec §Phase 6): error correction H, ≥ 4-module quiet zone, payload built only
// from NEXT_PUBLIC_SITE_URL (§11). Pure functions over the module grid, so the same code
// draws the SVG, the PNG and the PDF, and nothing here needs Node or a canvas.
import { create } from "qrcode";

export const QUIET_ZONE = 4; // modules; the spec minimum

export type QrMatrix = {
  size: number;
  dark: (x: number, y: number) => boolean;
};

export function qrMatrix(text: string): QrMatrix {
  const { modules } = create(text, { errorCorrectionLevel: "H" });
  return {
    size: modules.size,
    dark: (x, y) => Boolean(modules.get(y, x)),
  };
}

/** SVG path data, 1 unit per module, offset by the quiet zone; row runs merged. */
export function qrPath(m: QrMatrix): string {
  let d = "";
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (!m.dark(x, y)) continue;
      let run = 1;
      while (x + run < m.size && m.dark(x + run, y)) run++;
      d += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h${run}v1h-${run}z`;
      x += run - 1;
    }
  }
  return d;
}

/** One <path>, black on white, with the quiet zone. */
export function qrSvg(text: string, title?: string): string {
  const m = qrMatrix(text);
  const total = m.size + QUIET_ZONE * 2;
  const d = qrPath(m);
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img">` +
    (title ? `<title>${esc(title)}</title>` : "") +
    `<rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
  );
}

// ── PNG (grayscale, 8-bit) with the platform's CompressionStream("deflate") = zlib ──────────
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
async function deflate(data: Uint8Array) {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** PNG at `scale` pixels per module (e.g. 16 → ~1 000 px for a typical code). */
export async function qrPng(text: string, scale = 16): Promise<Uint8Array> {
  const m = qrMatrix(text);
  const px = (m.size + QUIET_ZONE * 2) * scale;
  const raw = new Uint8Array((px + 1) * px).fill(255);
  for (let y = 0; y < px; y++) {
    raw[y * (px + 1)] = 0; // filter: none
    const my = Math.floor(y / scale) - QUIET_ZONE;
    for (let x = 0; x < px; x++) {
      const mx = Math.floor(x / scale) - QUIET_ZONE;
      if (mx >= 0 && my >= 0 && mx < m.size && my < m.size && m.dark(mx, my))
        raw[y * (px + 1) + 1 + x] = 0;
    }
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, px);
  v.setUint32(4, px);
  ihdr.set([8, 0, 0, 0, 0], 8); // 8-bit grayscale, no interlace
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", await deflate(raw)),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
