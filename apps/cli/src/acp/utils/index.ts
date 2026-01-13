/**
 * ACP Utilities Module
 *
 * Shared utilities for the ACP implementation.
 */

export {
	// Configuration
	type FormatConfig,
	DEFAULT_FORMAT_CONFIG,
	// Result type
	type Result,
	ok,
	err,
	// Formatting functions
	formatSearchResults,
	formatReadContent,
	wrapInCodeBlock,
	// Content extraction
	extractContentFromParams,
	// File operations
	readFileContent,
	readFileContentAsync,
	resolveFilePath,
	resolveFilePathUnsafe,
	// Validation
	isUserEcho,
	hasValidFilePath,
} from "./format-utils.js"
