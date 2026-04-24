import type OpenAI from "openai"
import { approvalManager } from "@/core/intent/ApprovalManager"

const REQUEST_HUMAN_APPROVAL_DESCRIPTION = `Request explicit human approval for a critical code change.

This tool blocks agent execution until a human approves or rejects the proposed change. Use this when:
- Making changes outside the current intent's owned_scope
- Applying experimental refactorings that need validation
- Modifying critical infrastructure or security-sensitive code
- The change requires explicit override of scope enforcement

The request includes:
- Summary of the change (why and what)
- Full diff showing exact modifications  
- List of files affected
- Optional notes about the change

The approval decision is recorded in approval_log.jsonl with:
- Approver identity
- Approval timestamp
- Human notes (if provided)
- Whether override was required

The agent MUST wait for human response before proceeding.
`

const CHANGE_SUMMARY_DESCRIPTION = `Concise summary of the proposed change. This will be shown to the human approver. Should explain:
- What code is being changed
- Why the change is being made
- Any risks or special considerations`

const DIFF_DESCRIPTION = `Full unified diff of the proposed changes. Shows exact lines being added/removed. Include file paths for clarity.`

const FILES_AFFECTED_DESCRIPTION = `Array of file paths that will be modified by this change.`

const INTENT_ID_DESCRIPTION = `Optional: The intent ID associated with this change for audit trail purposes.`

export default {
	type: "function",
	function: {
		name: "request_human_approval",
		description: REQUEST_HUMAN_APPROVAL_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				change_summary: {
					type: "string",
					description: CHANGE_SUMMARY_DESCRIPTION,
				},
				diff: {
					type: "string",
					description: DIFF_DESCRIPTION,
				},
				files_affected: {
					type: "array",
					items: {
						type: "string",
					},
					description: FILES_AFFECTED_DESCRIPTION,
				},
				intent_id: {
					type: "string",
					description: INTENT_ID_DESCRIPTION,
				},
			},
			required: ["change_summary", "diff", "files_affected"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool

/**
 * Implementation of request_human_approval tool
 */
export async function requestHumanApproval(
	changeSummary: string,
	diff: string,
	filesAffected: string[],
	intentId?: string,
): Promise<{
	success: boolean
	request_id: string
	status: "pending" | "approved" | "rejected"
	message: string
}> {
	try {
		// Create approval request via ApprovalManager
		const request = approvalManager.createRequest(changeSummary, diff, filesAffected, intentId)

		// Submit for approval (blocks until decision)
		await approvalManager.submitForApproval(request)

		return {
			success: true,
			request_id: request.request_id,
			status: "pending",
			message: `Approval request submitted. Waiting for human review. Request ID: ${request.request_id}`,
		}
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err)
		return {
			success: false,
			request_id: "",
			status: "rejected",
			message: `Failed to submit approval request: ${errorMessage}`,
		}
	}
}
