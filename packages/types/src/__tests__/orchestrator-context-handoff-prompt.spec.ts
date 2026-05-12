import { DEFAULT_MODES } from "../mode.js"

describe("Orchestrator context handoff prompt", () => {
	const orchestratorMode = DEFAULT_MODES.find((m: { slug: string }) => m.slug === "orchestrator")

	it("should have an orchestrator mode", () => {
		expect(orchestratorMode).toBeDefined()
	})

	it("should include context handoff guidance in customInstructions", () => {
		expect(orchestratorMode!.customInstructions).toContain("structured context handoff summary")
	})

	it("should mention files modified in context handoff guidance", () => {
		expect(orchestratorMode!.customInstructions).toContain("files modified")
	})

	it("should mention passing context to subsequent subtasks", () => {
		expect(orchestratorMode!.customInstructions).toContain("subsequent subtasks")
	})

	it("should mention identifying potential conflicts", () => {
		expect(orchestratorMode!.customInstructions).toContain("potential conflicts")
	})
})
