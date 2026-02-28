import { SelectActiveIntentTool } from "../SelectActiveIntentTool"
import * as loader from "../../intent/IntentContextLoader"

vi.mock("../../intent/IntentContextLoader", async () => {
	const actual = await vi.importActual<typeof import("../../intent/IntentContextLoader")>(
		"../../intent/IntentContextLoader",
	)

	return {
		...actual,
		loadIntentContext: vi.fn(),
	}
})

describe("SelectActiveIntentTool", () => {
	const mockedLoadIntentContext = vi.mocked(loader.loadIntentContext)
	const tool = new SelectActiveIntentTool()
	const workspaceRoot = "/workspace"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("returns intent_context XML for matching intent in intents array", async () => {
		mockedLoadIntentContext.mockResolvedValue({
			intent_id: "intent-1",
			constraints: {
				must_not: ["direct_db_writes"],
			},
			scope: {
				files: ["src/**"],
			},
			relatedTraceEntries: [],
		})

		const result = await tool.handle({ intent_id: "intent-1" }, workspaceRoot)

		expect(result).toContain("<intent_context>")
		expect(result).toContain("<constraints>")
		expect(result).toContain("direct_db_writes")
		expect(result).toContain("<scope>")
		expect(result).toContain("src/**")
		expect(result).toContain("</intent_context>")
	})

	it("returns not found error when intent_id does not exist", async () => {
		mockedLoadIntentContext.mockResolvedValue(null)

		const result = await tool.handle({ intent_id: "intent-1" }, workspaceRoot)

		expect(result).toBe("ERROR: Intent 'intent-1' not found in .orchestration/active_intents.yaml.")
	})

	it("returns initialization error when sidecar file is missing", async () => {
		const missingFileError = Object.assign(new Error("ENOENT"), { code: "ENOENT" })
		mockedLoadIntentContext.mockRejectedValue(missingFileError)

		const result = await tool.handle({ intent_id: "intent-1" }, workspaceRoot)

		expect(result).toBe(
			"ERROR: Governance sidecar not found. Please ensure .orchestration/active_intents.yaml exists.",
		)
	})
})
