import * as fs from "fs"

import { SelectActiveIntentTool } from "../SelectActiveIntentTool"

describe("SelectActiveIntentTool", () => {
	const mockedReadFile = vi.spyOn(fs.promises, "readFile")
	const tool = new SelectActiveIntentTool()
	const workspaceRoot = "/workspace"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("returns intent_context XML for matching intent in intents array", async () => {
		mockedReadFile.mockResolvedValue(
			`intents:
  - intent_id: intent-1
    constraints:
      must_not:
        - direct_db_writes
    scope:
      files:
        - src/**
` as never,
		)

		const result = await tool.handle({ intent_id: "intent-1" }, workspaceRoot)

		expect(result).toContain("<intent_context>")
		expect(result).toContain('"intent_id": "intent-1"')
		expect(result).toContain('"constraints"')
		expect(result).toContain("direct_db_writes")
		expect(result).toContain('"scope"')
		expect(result).toContain("src/**")
		expect(result).toContain("</intent_context>")
	})

	it("returns not found error when intent_id does not exist", async () => {
		mockedReadFile.mockResolvedValue(
			`active_intents:
  - intent_id: intent-2
    constraints: {}
    scope: {}
` as never,
		)

		const result = await tool.handle({ intent_id: "intent-1" }, workspaceRoot)

		expect(result).toBe("ERROR: Intent 'intent-1' not found in .orchestration/active_intents.yaml.")
	})

	it("returns initialization error when sidecar file is missing", async () => {
		const missingFileError = Object.assign(new Error("ENOENT"), { code: "ENOENT" })
		mockedReadFile.mockRejectedValue(missingFileError)

		const result = await tool.handle({ intent_id: "intent-1" }, workspaceRoot)

		expect(result).toBe(
			"ERROR: Governance sidecar not found at .orchestration/active_intents.yaml. Please initialize Phase 0 first.",
		)
	})
})
