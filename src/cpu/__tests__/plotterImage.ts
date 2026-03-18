import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { DEFAULT_PLOTTER_COLOR, type PlotterPixels, unpackPlotterColor } from "../../plotter";

interface PlotterImageOptions {
  background?: { r: number; g: number; b: number };
  scale?: number;
  width?: number;
  height?: number;
}

function getColorBytes(
  pixels: PlotterPixels,
  x: number,
  y: number,
  background: { r: number; g: number; b: number },
): [number, number, number] {
  const packed = pixels.get(((y & 0xff) << 8) | (x & 0xff));
  if (packed === undefined) {
    return [background.r, background.g, background.b];
  }
  const color = unpackPlotterColor(packed);
  return [color.r, color.g, color.b];
}

export function writePlotterPpm(
  pixels: PlotterPixels,
  outputPath: string,
  options: PlotterImageOptions = {},
): void {
  const width = options.width ?? 256;
  const height = options.height ?? 256;
  const scale = Math.max(1, options.scale ?? 1);
  const background = options.background ?? { ...DEFAULT_PLOTTER_COLOR, r: 0, g: 0, b: 0 };

  const outWidth = width * scale;
  const outHeight = height * scale;
  const header = Buffer.from(`P6\n${outWidth} ${outHeight}\n255\n`, "ascii");
  const body = Buffer.alloc(outWidth * outHeight * 3);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    for (let sy = 0; sy < scale; sy++) {
      for (let x = 0; x < width; x++) {
        const [r, g, b] = getColorBytes(pixels, x, y, background);
        for (let sx = 0; sx < scale; sx++) {
          body[offset++] = r;
          body[offset++] = g;
          body[offset++] = b;
        }
      }
    }
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.concat([header, body]));
}
