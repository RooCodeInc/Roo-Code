/**
 * Represents a code snippet reference that can be added to the chat input.
 * The snippet is displayed in a collapsed/compressed form in the UI,
 * but the full code content is sent to the AI.
 */
export interface CodeSnippet {
	/** Unique identifier for the snippet */
	id: string
	/** File path relative to workspace */
	filePath: string
	/** Start line number (1-indexed) */
	startLine: number
	/** End line number (1-indexed) */
	endLine: number
	/** The actual code content */
	content: string
	/** Timestamp when the snippet was added */
	timestamp: number
}

/**
 * Creates a unique ID for a code snippet
 */
export function createCodeSnippetId(): string {
	return `snippet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Formats a code snippet for display in a collapsed chip/pill format
 */
export function formatCodeSnippetLabel(snippet: CodeSnippet): string {
	const fileName = snippet.filePath.split("/").pop() || snippet.filePath
	return `${fileName}:${snippet.startLine}-${snippet.endLine}`
}

/**
 * Expands a code snippet into the full text format to be sent to the AI
 */
export function expandCodeSnippet(snippet: CodeSnippet): string {
	return `${snippet.filePath}:${snippet.startLine}-${snippet.endLine}
\`\`\`
${snippet.content}
\`\`\``
}

/**
 * Expands multiple code snippets and joins them with spacing
 */
export function expandCodeSnippets(snippets: CodeSnippet[]): string {
	return snippets.map(expandCodeSnippet).join("\n\n")
}
