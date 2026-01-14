/**
 * Utilities for handling user content wrapper tags.
 * 
 * When the UNIFIED_USER_MESSAGE_TAG experiment is enabled, all user content
 * (task start, feedback, answers, resume messages) uses a single <user_message> tag.
 * 
 * When disabled (legacy mode), uses context-specific tags:
 * - <task> for initial task
 * - <feedback> for user feedback
 * - <answer> for follow-up question responses
 */

export type UserContentContext = "task" | "feedback" | "answer" | "resume"

/**
 * Get the opening tag for user content based on context and experiment setting
 */
export function getUserContentOpenTag(context: UserContentContext, useUnifiedTag: boolean): string {
	if (useUnifiedTag) {
		return "<user_message>"
	}

	switch (context) {
		case "task":
			return "<task>"
		case "feedback":
			return "<feedback>"
		case "answer":
			return "<answer>"
		case "resume":
			return "<user_message>"
		default:
			return "<user_message>"
	}
}

/**
 * Get the closing tag for user content based on context and experiment setting
 */
export function getUserContentCloseTag(context: UserContentContext, useUnifiedTag: boolean): string {
	if (useUnifiedTag) {
		return "</user_message>"
	}

	switch (context) {
		case "task":
			return "</task>"
		case "feedback":
			return "</feedback>"
		case "answer":
			return "</answer>"
		case "resume":
			return "</user_message>"
		default:
			return "</user_message>"
	}
}

/**
 * Wrap user content with appropriate tags
 */
export function wrapUserContent(content: string, context: UserContentContext, useUnifiedTag: boolean): string {
	const openTag = getUserContentOpenTag(context, useUnifiedTag)
	const closeTag = getUserContentCloseTag(context, useUnifiedTag)
	return `${openTag}\n${content}\n${closeTag}`
}

/**
 * Check if text contains any user content tags (for mention processing)
 */
export function hasUserContentTags(text: string, useUnifiedTag: boolean): boolean {
	if (useUnifiedTag) {
		return text.includes("<user_message>")
	}

	return (
		text.includes("<task>") ||
		text.includes("<feedback>") ||
		text.includes("<answer>") ||
		text.includes("<user_message>")
	)
}
