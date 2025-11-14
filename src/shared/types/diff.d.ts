declare module "diff" {
	export interface DiffHunk {
		oldStart: number
		oldLines: number
		newStart: number
		newLines: number
		lines: string[]
	}

	export interface ParsedDiff {
		oldFileName?: string | boolean
		newFileName?: string | boolean
		hunks?: DiffHunk[]
	}

	export function parsePatch(source: string): ParsedDiff[]

	export function createTwoFilesPatch(
		oldFileName: string,
		newFileName: string,
		oldStr: string,
		newStr: string,
		oldHeader?: string,
		newHeader?: string,
		options?: Record<string, unknown>,
	): string

	export function createPatch(
		fileName: string,
		oldStr: string,
		newStr: string,
		oldHeader?: string,
		newHeader?: string,
		options?: Record<string, unknown>,
	): string

	export interface LineDiffChange {
		added?: boolean
		removed?: boolean
		value: string
		count?: number
	}

	export function diffLines(oldStr: string, newStr: string, options?: Record<string, unknown>): LineDiffChange[]
}
