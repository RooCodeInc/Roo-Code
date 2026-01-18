import { getToolsForGroup, TOOL_GROUPS } from "../tools"

describe("getToolsForGroup", () => {
	test("should return tools for 'read' group", () => {
		const result = getToolsForGroup("read")
		expect(result).toEqual(["read_file", "fetch_instructions", "search_files", "list_files", "codebase_search"])
	})

	test("should return tools for 'edit' group (tools and customTools combined)", () => {
		const result = getToolsForGroup("edit")
		expect(result).toEqual([
			"apply_diff",
			"write_to_file",
			"generate_image",
			"search_and_replace",
			"search_replace",
			"edit_file",
			"apply_patch",
		])
	})

	test("should return tools for 'browser' group", () => {
		const result = getToolsForGroup("browser")
		expect(result).toEqual(["browser_action"])
	})

	test("should return tools for 'command' group", () => {
		const result = getToolsForGroup("command")
		expect(result).toEqual(["execute_command"])
	})

	test("should return tools for 'mcp' group", () => {
		const result = getToolsForGroup("mcp")
		expect(result).toEqual(["use_mcp_tool", "access_mcp_resource"])
	})

	test("should return tools for 'modes' group", () => {
		const result = getToolsForGroup("modes")
		expect(result).toEqual(["switch_mode", "new_task"])
	})

	test("should be case insensitive", () => {
		const result = getToolsForGroup("EDIT")
		expect(result).toEqual([
			"apply_diff",
			"write_to_file",
			"generate_image",
			"search_and_replace",
			"search_replace",
			"edit_file",
			"apply_patch",
		])
	})

	test("should return undefined for unknown groups", () => {
		const result = getToolsForGroup("unknown")
		expect(result).toBeUndefined()
	})

	test("should return undefined for empty string", () => {
		const result = getToolsForGroup("")
		expect(result).toBeUndefined()
	})
})
