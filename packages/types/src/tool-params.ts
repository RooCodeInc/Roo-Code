/**
 * Tool parameter type definitions for native protocol
 */

/**
 * Configuration for indentation-aware block extraction
 */
export interface IndentationConfig {
	/** The line to anchor the block expansion from (defaults to offset) */
	anchorLine?: number
	/** Maximum indentation depth to collect; 0 = unlimited */
	maxLevels?: number
	/** Whether to include sibling blocks at same indentation level */
	includeSiblings?: boolean
	/** Whether to include comment headers above the anchor block */
	includeHeader?: boolean
	/** Hard cap on returned lines (defaults to limit) */
	maxLines?: number
}

/**
 * Read mode for file content extraction
 */
export type ReadMode = "slice" | "indentation"

export interface FileEntry {
	path: string
	/** 1-indexed line number to start reading from (default: 1) */
	offset?: number
	/** Maximum number of lines to return (default: 2000) */
	limit?: number
	/** Reading mode: "slice" for simple reading, "indentation" for smart block extraction */
	mode?: ReadMode
	/** Configuration for indentation mode */
	indentation?: IndentationConfig
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
