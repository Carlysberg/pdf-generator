import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 40;
const GAP = 16;
const MAX_SIDE = 2000;
const INK = rgb(0.13, 0.15, 0.18);
const RULE = rgb(0.8, 0.82, 0.85);

let cachedFont: Buffer | null = null;
function fontBytes(): Buffer {
  if (!cachedFont)
    cachedFont = readFileSync(
      join(process.cwd(), "fonts", "DejaVuSans-Bold.ttf"),
    );
  return cachedFont;
}

interface Img {
  jpeg: Buffer;
  w: number;
  h: number;
}

async function prepare(data: Buffer): Promise<Img> {
  const jpeg = await sharp(data)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const meta = await sharp(jpeg).metadata();
  return { jpeg, w: meta.width!, h: meta.height! };
}

type Fit = [number, number];

function fit(w: number, h: number, bw: number, bh: number): Fit {
  const s = Math.min(bw / w, bh / h);
  return [w * s, h * s];
}

function bestLayout(
  sizes: Fit[],
  aw: number,
  ah: number,
): { mode: "stacked" | "beside"; fits: Fit[] } {
  const stacked = sizes.map(([w, h]) => fit(w, h, aw, (ah - GAP) / 2));
  const beside = sizes.map(([w, h]) => fit(w, h, (aw - GAP) / 2, ah));
  const area = (f: Fit[]) => f.reduce((s, [w, h]) => s + w * h, 0);
  return area(stacked) >= area(beside)
    ? { mode: "stacked", fits: stacked }
    : { mode: "beside", fits: beside };
}

function wrap(
  text: string,
  font: { widthOfTextAtSize(t: string, s: number): number },
  size: number,
  max: number,
): string[] {
  if (font.widthOfTextAtSize(text, size) <= max) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= max) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

const LABEL_SIZE = 10;
const VALUE_SIZE = 12;
const FIELD_GAP = 6;

export async function buildPdf(
  name: string,
  indexNumber: string,
  programOfStudy: string,
  ghanaCardNumber: string,
  image1: Buffer,
  image2: Buffer,
): Promise<Buffer> {
  const imgs = await Promise.all([prepare(image1), prepare(image2)]);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes());
  const page = doc.addPage([A4_W, A4_H]);
  const contentW = A4_W - 2 * MARGIN;

  let y = A4_H - MARGIN - LABEL_SIZE;
  const fields: [string, string][] = [
    ["Name", name],
    ["Index Number", indexNumber],
    ["Program of Study", programOfStudy],
    ["Ghana Card Number", ghanaCardNumber],
  ];
  const labelColor = rgb(0.45, 0.47, 0.5);
  for (const [label, value] of fields) {
    page.drawText(label, { x: MARGIN, y, size: LABEL_SIZE, font, color: labelColor });
    y -= VALUE_SIZE + 2;
    const valueLines = wrap(value, font, VALUE_SIZE, contentW);
    for (const vl of valueLines) {
      page.drawText(vl, { x: MARGIN, y, size: VALUE_SIZE, font, color: INK });
      y -= VALUE_SIZE * 1.25;
    }
    y -= FIELD_GAP;
  }

  const ruleY = y + FIELD_GAP / 2;
  page.drawLine({
    start: { x: MARGIN, y: ruleY },
    end: { x: A4_W - MARGIN, y: ruleY },
    thickness: 0.75,
    color: RULE,
  });

  const areaTop = ruleY - GAP / 2 - GAP;
  const areaH = areaTop - MARGIN;
  const sizes: Fit[] = imgs.map((i) => [i.w, i.h]);
  const { mode, fits } = bestLayout(sizes, contentW, areaH);

  const embedded = await Promise.all(imgs.map((i) => doc.embedJpg(i.jpeg)));

  if (mode === "stacked") {
    const slot = (areaH - GAP) / 2;
    for (let i = 0; i < 2; i++) {
      const [w, h] = fits[i];
      const top = areaTop - i * (slot + GAP) - (slot - h) / 2;
      page.drawImage(embedded[i], {
        x: (A4_W - w) / 2,
        y: top - h,
        width: w,
        height: h,
      });
    }
  } else {
    const slot = (contentW - GAP) / 2;
    const tallest = Math.max(...fits.map(([, h]) => h));
    const top = areaTop - (areaH - tallest) / 2;
    for (let i = 0; i < 2; i++) {
      const [w, h] = fits[i];
      const x = MARGIN + i * (slot + GAP) + (slot - w) / 2;
      page.drawImage(embedded[i], {
        x,
        y: top - (tallest - h) / 2 - h,
        width: w,
        height: h,
      });
    }
  }

  return Buffer.from(await doc.save());
}
