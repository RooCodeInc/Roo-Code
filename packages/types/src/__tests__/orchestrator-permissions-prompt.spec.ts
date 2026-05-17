import { describe, it, expect } from "vitest"
import { DEFAULT_MODES } from "../mode.js"
import type { ModeConfig } from "../mode.js"

describe("Orchestrator mode - permissions prompt guidance", () => {
	const orchestratorMode = DEFAULT_MODES.find((m: ModeConfig) => m.slug === "orchestrator")

	it("should have the orchestrator mode defined", () => {
		expect(orchestratorMode).toBeDefined()
	})

	it("should include permissions guidance in customInstructions", () => {
		expect(orchestratorMode!.customInstructions).toContain("permissions")
		expect(orchestratorMode!.customInstructions).toContain("filePatterns")
		expect(orchestratorMode!.customInstructions).toContain("commandPatterns")
		expect(orchestratorMode!.customInstructions).toContain("allowedTools")
		expect(orchestratorMode!.customInstructions).toContain("deniedTools")
	})

	it("should mention most-restrictive-wins semantics", () => {
		expect(orchestratorMode!.customInstructions).toContain("most-restrictive-wins")
	})

	it("should provide example use cases for permissions", () => {
		// Guidance about restricting file access
		expect(orchestratorMode!.customInstructions).toContain("specific directory")
		// Guidance about read-only research tasks
		expect(orchestratorMode!.customInstructions).toContain("read-only research")
		// Guidance about blocking shell access
		expect(orchestratorMode!.customInstructions).toContain("shell access")
	})
})
