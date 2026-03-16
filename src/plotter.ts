export interface PlotterColor {
  r: number;
  g: number;
  b: number;
}

export interface PlotterPixel {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
}

export type PlotterPixels = Map<number, number>;

export const DEFAULT_PLOTTER_COLOR: PlotterColor = {
  r: 0x22,
  g: 0xd3,
  b: 0xee,
};

export function encodePlotterCoord(x: number, y: number): number {
  return ((y & 0xff) << 8) | (x & 0xff);
}

export function packPlotterColor(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

export function unpackPlotterColor(color: number): PlotterColor {
  return {
    r: (color >> 16) & 0xff,
    g: (color >> 8) & 0xff,
    b: color & 0xff,
  };
}

export function serializePlotterPixels(pixels: PlotterPixels): PlotterPixel[] {
  return Array.from(pixels.entries(), ([coord, color]) => {
    const { r, g, b } = unpackPlotterColor(color);
    return {
      x: coord & 0xff,
      y: (coord >> 8) & 0xff,
      r,
      g,
      b,
    };
  });
}
