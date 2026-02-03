/**
 * Message formatting utilities for Telegram
 */

import type { ClineMessage } from "@roo-code/types"

// Telegram message length limit
const MAX_MESSAGE_LENGTH = 4096

// Map of ask types to human-readable descriptions
const ASK_TYPE_LABELS: Record<string, string> = {
	followup: "❓ Question",
	command: "⚡ Command Execution",
	command_output: "📄 Command Output",
	completion_result: "✅ Task Complete",
	tool: "🔧 Tool Operation",
	api_req_failed: "⚠️ API Request Failed",
	resume_task: "▶️ Resume Task",
	resume_completed_task: "🔄 Resume Completed Task",
	mistake_limit_reached: "🚫 Mistake Limit Reached",
	browser_action_launch: "🌐 Browser Action",
	use_mcp_server: "🔌 MCP Server",
	auto_approval_max_req_reached: "⏸️ Auto-approval Limit",
}

// Map of say types to human-readable descriptions
const SAY_TYPE_LABELS: Record<string, string> = {
	user_feedback: "💬 User Feedback",
	user_feedback_diff: "📝 Diff Feedback",
	api_req_started: "🔄 Processing...",
	api_req_finished: "✅ Processing Complete",
	api_req_retried: "🔄 Retrying...",
	api_req_failed: "❌ Request Failed",
	text: "💬",
	reasoning: "🧠 Reasoning",
	command: "⚡ Command",
	command_output: "📄 Output",
	completion_result: "✅ Complete",
	tool: "🔧 Tool",
	shell_integration_warning: "⚠️ Shell Warning",
	browser_action: "🌐 Browser",
	browser_action_result: "🌐 Browser Result",
	mcp_server_request_started: "🔌 MCP Request",
	mcp_server_response: "🔌 MCP Response",
	condense_context: "📦 Context Condensed",
	checkpoint_saved: "💾 Checkpoint Saved",
	roo_message: "🤖 Roo",
	error: "❌ Error",
	diff: "📝 Diff",
	clineignore_error: "⚠️ Ignore Error",
	sliding_window_truncation: "✂️ Truncated",
}

/**
 * Format a ClineMessage for display in Telegram
 */
export function formatMessageForTelegram(message: ClineMessage): string {
	const parts: string[] = []

	// Add type indicator
	if (message.type === "ask" && message.ask) {
		const label = ASK_TYPE_LABELS[message.ask] || `❓ ${message.ask}`
		parts.push(`<b>${label}</b>`)

		// Add approval request indicator
		if (isApprovalRequired(message.ask)) {
			parts.push("\n<i>Approval required</i>")
		}
	} else if (message.type === "say" && message.say) {
		const label = SAY_TYPE_LABELS[message.say] || message.say
		if (label !== "💬") {
			parts.push(`<b>${label}</b>`)
		}
	}

	// Add message text
	if (message.text) {
		const formattedText = escapeHtml(message.text)
		parts.push(formattedText)
	}

	// Add reasoning if present
	if (message.reasoning) {
		parts.push(`\n<i>Reasoning: ${escapeHtml(truncateMessage(message.reasoning, 500))}</i>`)
	}

	return truncateMessage(parts.join("\n"), MAX_MESSAGE_LENGTH)
}

/**
 * Check if an ask type requires user approval
 */
function isApprovalRequired(askType: string): boolean {
	const approvalAsks = ["command", "tool", "browser_action_launch", "use_mcp_server", "followup"]
	return approvalAsks.includes(askType)
}

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
}

/**
 * Truncate a message to a maximum length, adding ellipsis if needed
 */
export function truncateMessage(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text
	}
	return text.substring(0, maxLength - 3) + "..."
}

/**
 * Format a code block for Telegram
 */
export function formatCodeBlock(code: string, language?: string): string {
	const escapedCode = escapeHtml(code)
	if (language) {
		return `<pre><code class="language-${language}">${escapedCode}</code></pre>`
	}
	return `<pre>${escapedCode}</pre>`
}

/**
 * Format a diff for Telegram display
 */
export function formatDiff(diff: string): string {
	const lines = diff.split("\n")
	const formattedLines = lines.map((line) => {
		if (line.startsWith("+")) {
			return `<code>+ ${escapeHtml(line.substring(1))}</code>`
		} else if (line.startsWith("-")) {
			return `<code>- ${escapeHtml(line.substring(1))}</code>`
		}
		return escapeHtml(line)
	})
	return formattedLines.join("\n")
}
