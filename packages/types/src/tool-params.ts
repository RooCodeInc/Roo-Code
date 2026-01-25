/**
 * Tool parameter type definitions for native protocol
 */

export interface LineRange {
	start: number
	end: number
}

export interface FileEntry {
	path: string
	lineRanges?: LineRange[]
}

/**
 * read_file tool input parameters (new spec)
 */
export interface ReadFileInput {
	file_path: string
	offset?: number
	limit?: number
	format?: "cat_n"
	max_chars_per_line?: number
}

/**
 * read_file tool success output
 */
export interface ReadFileSuccess {
	ok: true
	file_path: string
	resolved_path: string
	mime_type: string
	encoding: string | null
	line_offset: number
	lines_returned: number
	reached_eof: boolean
	truncated: boolean
	truncation_reason?: "limit" | "max_chars_per_line" | "max_total_chars" | "binary_policy"
	next_offset: number | null
	content: string
	warnings: string[]
}

/**
 * read_file tool error output
 */
export interface ReadFileError {
	ok: false
	error: {
		code:
			| "file_not_found"
			| "permission_denied"
			| "outside_workspace"
			| "is_directory"
			| "unsupported_mime_type"
			| "decode_failed"
			| "io_error"
		message: string
		details?: Record<string, unknown>
	}
}

export type ReadFileOutput = ReadFileSuccess | ReadFileError

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
