import jsQR from "jsqr";
// @ts-expect-error pngjs ships no types; it comes with `qrcode` and is only used to decode here.
import { PNG } from "pngjs";
import { PDFDocument } from "pdf-lib";
import { create } from "qrcode";
import { describe, expect, test } from "vitest";
import { QUIET_ZONE, qrMatrix, qrPng, qrSvg } from "./code";
import { tableCardsPdf } from "./pdf";
import { isBot, uaFamily } from "./scan";

const URL_ = "https://flavoursbynajla.app/t/main";

describe("QR code", () => {
  test("PNG decodes back to the exact URL with an independent reader", async () => {
    const png = PNG.sync.read(Buffer.from(await qrPng(URL_, 8)));
    const rgba = new Uint8ClampedArray(png.data);
    expect(jsQR(rgba, png.width, png.height)?.data).toBe(URL_);
  });

  test("has a quiet zone of 4 modules (outer ring is white)", async () => {
    const scale = 4;
    const png = PNG.sync.read(Buffer.from(await qrPng(URL_, scale)));
    const edge = QUIET_ZONE * scale;
    for (let y = 0; y < png.height; y++)
      for (let x = 0; x < png.width; x++)
        if (
          x < edge ||
          y < edge ||
          x >= png.width - edge ||
          y >= png.height - edge
        )
          expect(png.data[(y * png.width + x) * 4]).toBe(255);
  });

  test("uses error correction H (larger symbol than level L would need)", () => {
    const size = (level: "L" | "H") =>
      create(URL_, { errorCorrectionLevel: level }).modules.size;
    expect(qrMatrix(URL_).size).toBe(size("H"));
    expect(size("H")).toBeGreaterThan(size("L"));
  });

  test("SVG is self-contained and escapes the title", () => {
    const svg = qrSvg(URL_, `A & B <menu>`);
    const total = qrMatrix(URL_).size + QUIET_ZONE * 2;
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain(`viewBox="0 0 ${total} ${total}"`);
    expect(svg).toContain("<title>A &#38; B &#60;menu&#62;</title>");
    expect(svg).not.toMatch(/<script|href=/);
  });
});

describe("table cards PDF", () => {
  test("one Letter page; text the standard fonts can't draw is dropped, not fatal", async () => {
    const bytes = await tableCardsPdf(
      URL_,
      {
        name: "Flavours by Najla طعم‌ها",
        line1: "Scan for our menu",
        line2: "Scannez pour voir le menu",
        footer: "flavoursbynajla.app",
      },
      "#6e1d3f",
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  });
});

describe("scan logging", () => {
  const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const PIXEL =
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
  test.each([
    [IPHONE, "iOS Safari"],
    [PIXEL, "Android Chrome"],
  ])("family of %s", (ua, family) => {
    expect(uaFamily(ua)).toBe(family);
    expect(isBot(ua)).toBe(false);
  });
  test.each([
    "WhatsApp/2.23.20.0",
    "facebookexternalhit/1.1",
    "curl/8.4.0",
    null,
  ])("%s is a bot", (ua) => expect(isBot(ua)).toBe(true));
});
