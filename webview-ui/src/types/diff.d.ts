declare module "diff" {
  export interface Hunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
  }

  export interface ParsedDiff {
    oldFileName?: string;
    newFileName?: string;
    hunks: Hunk[];
  }

  export function parsePatch(diff: string): ParsedDiff[];
}