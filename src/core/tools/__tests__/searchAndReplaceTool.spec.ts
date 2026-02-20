// Deprecated: Tests for the old SearchAndReplaceTool.
// Full edit tool tests are in editTool.spec.ts.
// This file only verifies the backward-compatible re-export.

import { searchAndReplaceTool } from "../SearchAndReplaceTool"
import { editTool } from "../EditTool"

describe("SearchAndReplaceTool re-export", () => {
	it("exports searchAndReplaceTool as an alias for editTool", () => {
		expect(searchAndReplaceTool).toBeDefined()
		expect(searchAndReplaceTool).toBe(editTool)
	})
})
