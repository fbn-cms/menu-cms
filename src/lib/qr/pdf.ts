// Print-ready table cards: US Letter, four 4.25 × 5.5 in cards per page with cut lines.
// The QR is vector (one rectangle per run of dark modules) and 2.5 in wide: far above the
// 3 cm minimum, readable from a seat. Standard PDF fonts only (no font files to ship).
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { QUIET_ZONE, qrMatrix, qrPath } from "./code";

const PAGE = { w: 612, h: 792 }; // points (1/72 in)
const CARD = { w: PAGE.w / 2, h: PAGE.h / 2 };
const QR_SIZE = 180; // points incl. quiet zone = 2.5 in ≈ 6.35 cm

export type CardText = {
  name: string;
  line1: string; // e.g. "Scan for our menu"
  line2: string; // e.g. "Scannez pour voir le menu"
  footer: string; // e.g. the bare host
};

const hexRgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/** Drop characters the standard (WinAnsi) fonts can't encode, e.g. Persian script. */
function encodable(font: PDFFont, text: string) {
  return [...text]
    .filter((ch) => {
      try {
        font.encodeText(ch);
        return true;
      } catch {
        return false;
      }
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function centered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  maxSize: number,
  cx: number,
  y: number,
  color = rgb(0.1, 0.1, 0.1),
) {
  const t = encodable(font, text);
  let size = maxSize;
  while (size > 8 && font.widthOfTextAtSize(t, size) > CARD.w - 48) size -= 0.5;
  page.drawText(t, {
    x: cx - font.widthOfTextAtSize(t, size) / 2,
    y,
    size,
    font,
    color,
  });
}

export async function tableCardsPdf(
  url: string,
  text: CardText,
  accentHex = "#1a1a1a",
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${text.name} — table cards`);
  doc.setCreator("Menu CMS");
  const [serif, sans, sansBold] = await Promise.all([
    doc.embedFont(StandardFonts.TimesRomanBold),
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
  ]);
  const accent = hexRgb(accentHex);
  const m = qrMatrix(url);
  const unit = QR_SIZE / (m.size + QUIET_ZONE * 2);
  const path = qrPath(m);
  const page = doc.addPage([PAGE.w, PAGE.h]);

  // Cut lines.
  const cut = {
    thickness: 0.5,
    color: rgb(0.75, 0.75, 0.75),
    dashArray: [4, 4],
  };
  page.drawLine({
    start: { x: CARD.w, y: 0 },
    end: { x: CARD.w, y: PAGE.h },
    ...cut,
  });
  page.drawLine({
    start: { x: 0, y: CARD.h },
    end: { x: PAGE.w, y: CARD.h },
    ...cut,
  });

  for (const [col, row] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const) {
    const left = col * CARD.w;
    const top = PAGE.h - row * CARD.h;
    const cx = left + CARD.w / 2;

    centered(page, text.name, serif, 24, cx, top - 62);
    page.drawLine({
      start: { x: cx - 22, y: top - 76 },
      end: { x: cx + 22, y: top - 76 },
      thickness: 1.5,
      color: accent,
    });
    centered(page, text.line1, sansBold, 14, cx, top - 102);
    centered(page, text.line2, sans, 11, cx, top - 119, rgb(0.35, 0.35, 0.35));

    // QR: one filled path (separate rectangles leave hairline seams in some viewers).
    // The white quiet zone is the card itself.
    const qx = cx - QR_SIZE / 2;
    const qTop = top - 134;
    page.drawSvgPath(path, {
      x: qx,
      y: qTop,
      scale: unit,
      color: rgb(0, 0, 0),
    });
    centered(
      page,
      text.footer,
      sans,
      10,
      cx,
      qTop - QR_SIZE - 18,
      rgb(0.35, 0.35, 0.35),
    );
  }
  return doc.save();
}
