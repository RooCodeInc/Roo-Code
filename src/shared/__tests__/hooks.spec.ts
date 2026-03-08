import { validateHooksConfig, type HooksConfig } from "../hooks"

describe("validateHooksConfig", () => {
	it("should return null for null/undefined input", () => {
		expect(validateHooksConfig(null)).toBeNull()
		expect(validateHooksConfig(undefined)).toBeNull()
	})

	it("should return null for non-object input", () => {
		expect(validateHooksConfig("string")).toBeNull()
		expect(validateHooksConfig(123)).toBeNull()
		expect(validateHooksConfig(true)).toBeNull()
	})

	it("should return null when hooks key is missing", () => {
		expect(validateHooksConfig({})).toBeNull()
		expect(validateHooksConfig({ other: "data" })).toBeNull()
	})

	it("should return null when hooks is not an object", () => {
		expect(validateHooksConfig({ hooks: "string" })).toBeNull()
		expect(validateHooksConfig({ hooks: 123 })).toBeNull()
	})

	it("should accept empty hooks object", () => {
		const result = validateHooksConfig({ hooks: {} })
		expect(result).toEqual({ hooks: {} })
	})

	it("should accept valid PreToolUse hooks", () => {
		const config = {
			hooks: {
				PreToolUse: [
					{
						matcher: "write_to_file|apply_diff",
						prompt: "Review this code change for security issues",
					},
				],
			},
		}
		const result = validateHooksConfig(config)
		expect(result).not.toBeNull()
		expect(result!.hooks.PreToolUse).toHaveLength(1)
		expect(result!.hooks.PreToolUse![0].matcher).toBe("write_to_file|apply_diff")
		expect(result!.hooks.PreToolUse![0].prompt).toBe("Review this code change for security issues")
	})

	it("should accept hooks without matcher (matches all tools)", () => {
		const config = {
			hooks: {
				PostToolUse: [
					{
						prompt: "Summarize what happened",
					},
				],
			},
		}
		const result = validateHooksConfig(config)
		expect(result).not.toBeNull()
		expect(result!.hooks.PostToolUse).toHaveLength(1)
		expect(result!.hooks.PostToolUse![0].matcher).toBeUndefined()
	})

	it("should accept valid Stop hooks", () => {
		const config = {
			hooks: {
				Stop: [
					{
						prompt: "Review the final result",
					},
				],
			},
		}
		const result = validateHooksConfig(config)
		expect(result).not.toBeNull()
		expect(result!.hooks.Stop).toHaveLength(1)
	})

	it("should accept multiple hooks per event", () => {
		const config = {
			hooks: {
				PreToolUse: [{ prompt: "Hook 1" }, { prompt: "Hook 2" }, { prompt: "Hook 3" }],
			},
		}
		const result = validateHooksConfig(config)
		expect(result).not.toBeNull()
		expect(result!.hooks.PreToolUse).toHaveLength(3)
	})

	it("should accept multiple event types", () => {
		const config = {
			hooks: {
				PreToolUse: [{ prompt: "Pre hook" }],
				PostToolUse: [{ prompt: "Post hook" }],
				Stop: [{ prompt: "Stop hook" }],
			},
		}
		const result = validateHooksConfig(config)
		expect(result).not.toBeNull()
		expect(result!.hooks.PreToolUse).toHaveLength(1)
		expect(result!.hooks.PostToolUse).toHaveLength(1)
		expect(result!.hooks.Stop).toHaveLength(1)
	})

	it("should return null for empty prompt", () => {
		const config = {
			hooks: {
				PreToolUse: [{ prompt: "" }],
			},
		}
		expect(validateHooksConfig(config)).toBeNull()
	})

	it("should return null for whitespace-only prompt", () => {
		const config = {
			hooks: {
				PreToolUse: [{ prompt: "   " }],
			},
		}
		expect(validateHooksConfig(config)).toBeNull()
	})

	it("should return null for non-string prompt", () => {
		const config = {
			hooks: {
				PreToolUse: [{ prompt: 123 }],
			},
		}
		expect(validateHooksConfig(config)).toBeNull()
	})

	it("should return null for non-string matcher", () => {
		const config = {
			hooks: {
				PreToolUse: [{ prompt: "test", matcher: 123 }],
			},
		}
		expect(validateHooksConfig(config)).toBeNull()
	})

	it("should return null for invalid regex matcher", () => {
		const config = {
			hooks: {
				PreToolUse: [{ prompt: "test", matcher: "[invalid" }],
			},
		}
		expect(validateHooksConfig(config)).toBeNull()
	})

	it("should return null for non-array hook definitions", () => {
		const config = {
			hooks: {
				PreToolUse: "not an array",
			},
		}
		expect(validateHooksConfig(config)).toBeNull()
	})

	it("should return null for non-object hook definition items", () => {
		const config = {
			hooks: {
				PreToolUse: ["string item"],
			},
		}
		expect(validateHooksConfig(config)).toBeNull()
	})

	it("should ignore unknown event names", () => {
		const config = {
			hooks: {
				PreToolUse: [{ prompt: "valid" }],
				UnknownEvent: [{ prompt: "ignored" }],
			},
		}
		const result = validateHooksConfig(config)
		expect(result).not.toBeNull()
		expect(result!.hooks.PreToolUse).toHaveLength(1)
		expect((result!.hooks as any).UnknownEvent).toBeUndefined()
	})
})
