import { visit } from "unist-util-visit"

/**
 * Supported GitHub-style alert types.
 */
export const ALERT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const
export type AlertType = (typeof ALERT_TYPES)[number]

/**
 * Pattern to match alert markers like [!NOTE], [!TIP], etc.
 * Must appear at the very start of text content in the first paragraph of a blockquote.
 */
const ALERT_PATTERN = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i

// Minimal AST node interfaces matching the unist/mdast shape used by remark.
// Defined locally to avoid adding @types/mdast as a dependency.
interface MdastNode {
	type: string
	value?: string
	children?: MdastNode[]
	data?: Record<string, unknown>
}

/**
 * Extracts the alert type from a blockquote node if it starts with a GitHub-style
 * alert marker. Returns the alert type and modifies the AST to remove the marker
 * text from the content.
 *
 * Returns null if the blockquote is not an alert.
 */
export function extractAlertType(node: MdastNode): AlertType | null {
	// The blockquote must have children
	if (!node.children || node.children.length === 0) {
		return null
	}

	// First child must be a paragraph
	const firstChild = node.children[0]
	if (firstChild.type !== "paragraph") {
		return null
	}

	// The paragraph must have children
	if (!firstChild.children || firstChild.children.length === 0) {
		return null
	}

	// First child of paragraph must be text
	const firstInline = firstChild.children[0]
	if (firstInline.type !== "text" || typeof firstInline.value !== "string") {
		return null
	}

	const match = ALERT_PATTERN.exec(firstInline.value)
	if (!match) {
		return null
	}

	const alertType = match[1].toUpperCase() as AlertType

	// Remove the alert marker from the text
	const remaining = firstInline.value.slice(match[0].length)

	if (remaining.length > 0) {
		// There's remaining text after the marker on the same line
		firstInline.value = remaining
	} else if (firstChild.children.length > 1) {
		// The marker was the entire first text node; remove it.
		firstChild.children.splice(0, 1)

		// If the next element is a `break` node, remove it as well
		// (this handles the case where [!NOTE]\n becomes text + break + text)
		if (firstChild.children.length > 0 && firstChild.children[0].type === "break") {
			firstChild.children.splice(0, 1)
		}
	} else {
		// The marker was the only content in the paragraph.
		// If there are more children in the blockquote, remove this paragraph.
		if (node.children.length > 1) {
			node.children.splice(0, 1)
		} else {
			// Empty the text node - the alert will just show the title
			firstInline.value = ""
		}
	}

	return alertType
}

/**
 * Alert type display labels.
 */
export const ALERT_LABELS: Record<AlertType, string> = {
	NOTE: "Note",
	TIP: "Tip",
	IMPORTANT: "Important",
	WARNING: "Warning",
	CAUTION: "Caution",
}

/**
 * A local remark plugin that transforms GitHub-style alert blockquotes into
 * annotated nodes for rendering. Detects [!NOTE], [!TIP], [!IMPORTANT],
 * [!WARNING], and [!CAUTION] markers and adds data attributes for styling.
 *
 * Normal blockquotes without alert markers are left unchanged.
 */
export default function remarkGithubAlerts() {
	return (tree: MdastNode) => {
		visit(tree as any, "blockquote", (node: any) => {
			const alertType = extractAlertType(node as MdastNode)
			if (!alertType) {
				return
			}

			// Add hProperties so react-markdown passes them as props to the
			// rendered blockquote element
			const data = (node.data = node.data || {})
			const hProperties = (data.hProperties = data.hProperties || {})
			hProperties["data-alert-type"] = alertType.toLowerCase()
			hProperties["className"] = `markdown-alert markdown-alert-${alertType.toLowerCase()}`
		})
	}
}
