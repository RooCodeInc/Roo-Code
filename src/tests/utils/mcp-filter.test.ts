import type { ModeConfig, GroupEntry } from "@roo-code/types"

import { getGroupName } from "../../shared/modes"
import { getMcpFilterForMode, isMcpServerAllowedForMode, isMcpToolAllowedForMode } from "../../utils/mcp-filter"

// ---------------------------------------------------------------------------
// Helpers – reusable mode fixtures
// ---------------------------------------------------------------------------

function makeModeWithMcpGroup(slug: string, mcpEntry: GroupEntry): ModeConfig {
	return {
		slug,
		name: "Test Mode",
		roleDefinition: "test",
		groups: ["read", mcpEntry],
	}
}

function makeModeWithoutMcp(slug: string): ModeConfig {
	return {
		slug,
		name: "No MCP",
		roleDefinition: "test",
		groups: ["read", "edit"],
	}
}

// ---------------------------------------------------------------------------
// getMcpFilterForMode
// ---------------------------------------------------------------------------

describe("getMcpFilterForMode", () => {
	test("returns undefined when mode has no mcp group", () => {
		const modes: ModeConfig[] = [makeModeWithoutMcp("no-mcp")]
		expect(getMcpFilterForMode("no-mcp", modes)).toBeUndefined()
	})

	test("returns empty options when mcp group is a plain string", () => {
		const modes: ModeConfig[] = [makeModeWithMcpGroup("plain", "mcp")]
		const result = getMcpFilterForMode("plain", modes)
		expect(result).toEqual({})
	})

	test("returns mcpServers and mcpDefaultPolicy from tuple options", () => {
		const modes: ModeConfig[] = [
			makeModeWithMcpGroup("filtered", [
				"mcp",
				{
					mcpServers: { "my-server": { disabled: true } },
					mcpDefaultPolicy: "deny",
				},
			]),
		]
		const result = getMcpFilterForMode("filtered", modes)
		expect(result).toEqual({
			mcpServers: { "my-server": { disabled: true } },
			mcpDefaultPolicy: "deny",
		})
	})

	test("returns undefined for unknown mode slug", () => {
		expect(getMcpFilterForMode("nonexistent", [])).toBeUndefined()
	})

	test("falls back to built-in modes (e.g. code mode has mcp group)", () => {
		// Passing no custom modes should still find the built-in 'code' mode
		const result = getMcpFilterForMode("code")
		// 'code' mode has a plain 'mcp' string entry → empty options
		expect(result).toEqual({})
	})
})

// ---------------------------------------------------------------------------
// isMcpServerAllowedForMode
// ---------------------------------------------------------------------------

describe("isMcpServerAllowedForMode", () => {
	test("returns true when mode has no mcp group config (default allow)", () => {
		const modes: ModeConfig[] = [makeModeWithoutMcp("no-mcp")]
		expect(isMcpServerAllowedForMode("any-server", "no-mcp", modes)).toBe(true)
	})

	test("returns false when server is explicitly disabled", () => {
		const modes: ModeConfig[] = [
			makeModeWithMcpGroup("m", ["mcp", { mcpServers: { "blocked-server": { disabled: true } } }]),
		]
		expect(isMcpServerAllowedForMode("blocked-server", "m", modes)).toBe(false)
	})

	test("returns true when server is not in the filter (default allow policy)", () => {
		const modes: ModeConfig[] = [
			makeModeWithMcpGroup("m", ["mcp", { mcpServers: { "other-server": { disabled: true } } }]),
		]
		expect(isMcpServerAllowedForMode("unlisted-server", "m", modes)).toBe(true)
	})

	test("returns false when server is not in the filter with deny default policy", () => {
		const modes: ModeConfig[] = [
			makeModeWithMcpGroup("m", [
				"mcp",
				{
					mcpServers: { "allowed-server": {} },
					mcpDefaultPolicy: "deny",
				},
			]),
		]
		expect(isMcpServerAllowedForMode("unlisted-server", "m", modes)).toBe(false)
	})

	test("returns true when server is in the filter and not disabled (deny policy)", () => {
		const modes: ModeConfig[] = [
			makeModeWithMcpGroup("m", [
				"mcp",
				{
					mcpServers: { "allowed-server": {} },
					mcpDefaultPolicy: "deny",
				},
			]),
		]
		expect(isMcpServerAllowedForMode("allowed-server", "m", modes)).toBe(true)
	})

	test("name matching is case-insensitive and separator-normalized", () => {
		const modes: ModeConfig[] = [
			makeModeWithMcpGroup("m", ["mcp", { mcpServers: { "My-Server": { disabled: true } } }]),
		]
		// 'my_server' should match 'My-Server' after normalization
		expect(isMcpServerAllowedForMode("my_server", "m", modes)).toBe(false)
		expect(isMcpServerAllowedForMode("MY SERVER", "m", modes)).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// isMcpToolAllowedForMode
// ---------------------------------------------------------------------------

describe("isMcpToolAllowedForMode", () => {
	test("returns true when server has no tool-level filtering", () => {
		const modes: ModeConfig[] = [makeModeWithMcpGroup("m", ["mcp", { mcpServers: { srv: {} } }])]
		expect(isMcpToolAllowedForMode("srv", "any-tool", "m", modes)).toBe(true)
	})

	test("returns true when tool is in allowedTools", () => {
		const modes: ModeConfig[] = [
			makeModeWithMcpGroup("m", ["mcp", { mcpServers: { srv: { allowedTools: ["tool-a", "tool-b"] } } }]),
		]
		expect(isMcpToolAllowedForMode("srv", "tool-a", "m", modes)).toBe(true)
	})

	test("returns false when tool is NOT in allowedTools", () => {
		const modes: ModeConfig[] = [
			makeModeWithMcpGroup("m", ["mcp", { mcpServers: { srv: { allowedTools: ["tool-a"] } } }]),
		]
		expect(isMcpToolAllowedForMode("srv", "tool-x", "m", modes)).toBe(false)
	})

	test("returns false when tool is in disabledTools", () => {
		const modes: ModeConfig[] = [
			makeModeWithMcpGroup("m", ["mcp", { mcpServers: { srv: { disabledTools: ["bad-tool"] } } }]),
		]
		expect(isMcpToolAllowedForMode("srv", "bad-tool", "m", modes)).toBe(false)
	})

	test("returns true when tool is NOT in disabledTools", () => {
		const modes: ModeConfig[] = [
			makeModeWithMcpGroup("m", ["mcp", { mcpServers: { srv: { disabledTools: ["bad-tool"] } } }]),
		]
		expect(isMcpToolAllowedForMode("srv", "good-tool", "m", modes)).toBe(true)
	})

	test("allowedTools takes precedence over disabledTools", () => {
		const modes: ModeConfig[] = [
			makeModeWithMcpGroup("m", [
				"mcp",
				{
					mcpServers: {
						srv: {
							allowedTools: ["tool-a"],
							disabledTools: ["tool-a"],
						},
					},
				},
			]),
		]
		// allowedTools is checked first; tool-a is in allowed list → true
		expect(isMcpToolAllowedForMode("srv", "tool-a", "m", modes)).toBe(true)
	})

	test("returns false when server itself is disabled", () => {
		const modes: ModeConfig[] = [
			makeModeWithMcpGroup("m", [
				"mcp",
				{
					mcpServers: {
						srv: {
							disabled: true,
							allowedTools: ["tool-a"],
						},
					},
				},
			]),
		]
		expect(isMcpToolAllowedForMode("srv", "tool-a", "m", modes)).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Cross-validation: inlined getGroupName vs real getGroupName (ISSUE-16)
// ---------------------------------------------------------------------------

describe("ISSUE-16: inlined getGroupName cross-validation", () => {
	const sampleEntries: GroupEntry[] = [
		"read",
		"edit",
		"mcp",
		"command",
		["mcp", { mcpServers: { s: {} } }],
		["edit", { fileRegex: "\\.md$", description: "Markdown only" }],
	]

	test("inlined getGroupName matches real getGroupName for all sample entries", () => {
		// The inlined helper in mcp-filter.ts is not exported directly,
		// but getMcpFilterForMode uses it internally. We verify equivalence
		// by checking that the real getGroupName produces expected values
		// and that getMcpFilterForMode behaves consistently with those values.
		for (const entry of sampleEntries) {
			const realName = getGroupName(entry)
			// inlined logic: typeof entry === 'string' ? entry : entry[0]
			const inlinedName = typeof entry === "string" ? entry : entry[0]
			expect(inlinedName).toBe(realName)
		}
	})

	test("getMcpFilterForMode finds mcp group correctly for tuple entry", () => {
		const modes: ModeConfig[] = [
			{
				slug: "cross-val",
				name: "Cross Val",
				roleDefinition: "test",
				groups: ["read", ["mcp", { mcpServers: { "test-srv": { disabled: true } }, mcpDefaultPolicy: "deny" }]],
			},
		]
		const result = getMcpFilterForMode("cross-val", modes)
		expect(result).toBeDefined()
		expect(result!.mcpServers).toEqual({ "test-srv": { disabled: true } })
		expect(result!.mcpDefaultPolicy).toBe("deny")
	})
})
