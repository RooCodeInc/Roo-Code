/**
 * Tool parameter type definitions for native protocol
 */

/**
 * Read mode for the read_file tool.
 * - "slice": Simple offset/limit reading (default)
 * - "indentation": Semantic block extraction based on code structure
 */
export type ReadFileMode = "slice" | "indentation"

/**
 * Indentation-mode configuration for the read_file tool.
 */
export interface IndentationParams {
	/** 1-based line number to anchor indentation extraction (defaults to offset) */
	anchor_line?: number
	/** Maximum indentation levels to include above anchor (0 = unlimited) */
	max_levels?: number
	/** Include sibling blocks at the same indentation level */
	include_siblings?: boolean
	/** Include file header (imports, comments at top) */
	include_header?: boolean
	/** Hard cap on lines returned for indentation mode */
	max_lines?: number
}

/**
 * Parameters for the read_file tool.
 *
 * NOTE: This is the canonical, single-file-per-call shape.
 */
export interface ReadFileParams {
	/** Path to the file, relative to workspace */
	path: string
	/** Reading mode: "slice" (default) or "indentation" */
	mode?: ReadFileMode
	/** 1-based line number to start reading from (slice mode, default: 1) */
	offset?: number
	/** Maximum number of lines to read (default: 2000) */
	limit?: number
	/** Indentation-mode configuration (only used when mode === "indentation") */
	indentation?: IndentationParams
}

export interface Coordinate {
	x: number
	y: number
}

export interface Size {
	width: number
	height: number
}

export interface BrowserActionParams {
	action: "launch" | "click" | "hover" | "type" | "scroll_down" | "scroll_up" | "resize" | "close" | "screenshot"
	url?: string
	coordinate?: Coordinate
	size?: Size
	text?: string
	path?: string
}

export interface GenerateImageParams {
	prompt: string
	path: string
	image?: string
}
