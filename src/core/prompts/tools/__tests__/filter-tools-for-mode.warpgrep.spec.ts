import type OpenAI from "openai"

import { filterNativeToolsForMode, isToolAllowedInMode } from "../filter-tools-for-mode"

function makeTool(name: string): OpenAI.Chat.ChatCompletionTool {
	return {
		type: "function",
		function: {
			name,
			description: `${name} tool`,
			parameters: { type: "object", properties: {} },
		},
	} as OpenAI.Chat.ChatCompletionTool
}

describe("filterNativeToolsForMode - WarpGrep", () => {
	it("keeps codebase_search available when WarpGrep is enabled", () => {
		const result = filterNativeToolsForMode(
			[makeTool("codebase_search"), makeTool("read_file")],
			"code",
			undefined,
			undefined,
			undefined,
			{
				codebaseIndexConfig: {
					warpGrepEnabled: true,
				},
			},
		)

		expect(result.map((tool) => (tool as any).function.name)).toContain("codebase_search")
	})

	it("reports codebase_search as allowed when WarpGrep is enabled", () => {
		expect(
			isToolAllowedInMode("codebase_search", "code", undefined, undefined, undefined, {
				codebaseIndexConfig: {
					warpGrepEnabled: true,
				},
			}),
		).toBe(true)
	})
})
