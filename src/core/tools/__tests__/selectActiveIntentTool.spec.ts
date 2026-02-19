import { selectActiveIntentTool } from "../SelectActiveIntentTool"
import type { ToolUse } from "../../../shared/tools"

const selectIntent = vi.fn()
const markIntentInProgress = vi.fn()

vi.mock("../../../hooks/IntentContextService", () => ({
	IntentContextService: class {
		async selectIntent(intentId: string) {
			return selectIntent(intentId)
		}
		async markIntentInProgress(intentId: string) {
			return markIntentInProgress(intentId)
		}
	},
}))

vi.mock("../../../hooks/OrchestrationStore", () => ({
	OrchestrationStore: class {},
}))

describe("selectActiveIntentTool", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("uses pre-hook injected handshake context when available", async () => {
		selectIntent.mockResolvedValue({
			found: true,
			context: { id: "INT-1" },
			availableIntentIds: ["INT-1"],
			message: "Selected active intent context",
		})
		markIntentInProgress.mockResolvedValue(undefined)

		const task = {
			cwd: "/workspace",
			workspacePath: "/workspace",
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			setActiveIntentId: vi.fn(),
			authorizeIntentCheckoutForTurn: vi.fn(),
			consumePendingIntentHandshakeContext: vi.fn().mockReturnValue("Injected deep context from pre-hook"),
			sayAndCreateMissingParamError: vi.fn(),
		} as any

		const pushToolResult = vi.fn()
		const block: ToolUse<"select_active_intent"> = {
			type: "tool_use",
			name: "select_active_intent",
			params: { intent_id: "INT-1" },
			partial: false,
			nativeArgs: { intent_id: "INT-1" },
		}

		await selectActiveIntentTool.handle(task, block, {
			askApproval: vi.fn(),
			handleError: vi.fn(),
			pushToolResult,
		})

		expect(task.setActiveIntentId).toHaveBeenCalledWith("INT-1")
		expect(task.authorizeIntentCheckoutForTurn).toHaveBeenCalledWith("INT-1")
		expect(pushToolResult).toHaveBeenCalledWith("Injected deep context from pre-hook")
	})
})
