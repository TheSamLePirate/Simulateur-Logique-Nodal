import type { PlotterColor, PlotterPixel } from "../../plotter";

export interface HardwareSyncData {
  pc: number;
  a: number;
  b: number;
  sp: number;
  memory: Uint8Array;
  flags: { z: boolean; c: boolean; n: boolean };
  consoleText: string;
  plotterPixels: PlotterPixel[];
  plotterColor: PlotterColor;
  driveData: Uint8Array;
  driveLastAddr: number;
  driveLastRead: number;
  driveLastWrite: number;
  networkMethod: "GET" | "POST";
  networkUrl: string;
  networkBody: string;
  networkStatus: string;
  networkPending: boolean;
  networkResponseBuffer: number[];
  networkLastByte: number;
  networkCompletedMethod: "GET" | "POST";
  networkCompletedUrl: string;
  networkCompletedBody: string;
  networkCompletedStatus: string;
  networkCompletedResponseText: string;
  halted: boolean;
}
