import { getObjectiveSection } from "../objective"
import type { CodeIndexManager } from "../../../../services/code-index/manager"

describe("getObjectiveSection", () => {
	// Mock CodeIndexManager with codebase search available
	const mockCodeIndexManagerEnabled = {
		isFeatureEnabled: true,
		isFeatureConfigured: true,
		isInitialized: true,
	} as CodeIndexManager

	// Mock CodeIndexManager with codebase search unavailable
	const mockCodeIndexManagerDisabled = {
		isFeatureEnabled: false,
		isFeatureConfigured: false,
		isInitialized: false,
	} as CodeIndexManager

	describe("when codebase_search is available", () => {
		it("should include codebase_search first enforcement in thinking process", () => {
			const objective = getObjectiveSection(mockCodeIndexManagerEnabled)

			// Check that the objective includes the codebase_search enforcement
			expect(objective).toContain(
				"for ANY exploration of code you haven't examined yet in this conversation, you MUST use the `codebase_search` tool",
			)
			expect(objective).toContain("BEFORE using any other search or file exploration tools")
			expect(objective).toContain("This applies throughout the entire task, not just at the beginning")
		})
	})

	describe("when codebase_search is not available", () => {
		it("should not include codebase_search enforcement", () => {
			const objective = getObjectiveSection(mockCodeIndexManagerDisabled)

			// Check that the objective does not include the codebase_search enforcement
			expect(objective).not.toContain("you MUST use the `codebase_search` tool")
			expect(objective).not.toContain("BEFORE using any other search or file exploration tools")
		})
	})

	it("should maintain proper structure regardless of codebase_search availability", () => {
		const objectiveEnabled = getObjectiveSection(mockCodeIndexManagerEnabled)
		const objectiveDisabled = getObjectiveSection(mockCodeIndexManagerDisabled)

		// Check that all numbered items are present in both cases
		for (const objective of [objectiveEnabled, objectiveDisabled]) {
			expect(objective).toContain("1. Analyze the user's task")
			expect(objective).toContain("2. Work through these goals sequentially")
			expect(objective).toContain("3. Remember, you have extensive capabilities")
			expect(objective).toContain("4. Once you've completed the user's task")
			expect(objective).toContain("5. The user may provide feedback")
		}
	})

	it("should include analysis guidance regardless of codebase_search availability", () => {
		const objectiveEnabled = getObjectiveSection(mockCodeIndexManagerEnabled)
		const objectiveDisabled = getObjectiveSection(mockCodeIndexManagerDisabled)

		// Check that analysis guidance is included in both cases
		for (const objective of [objectiveEnabled, objectiveDisabled]) {
			expect(objective).toContain("Before calling a tool, do some analysis")
			expect(objective).toContain("analyze the file structure provided in environment_details")
			expect(objective).toContain("think about which of the provided tools is the most relevant")
		}
	})

	it("should include parameter inference guidance regardless of codebase_search availability", () => {
		const objectiveEnabled = getObjectiveSection(mockCodeIndexManagerEnabled)
		const objectiveDisabled = getObjectiveSection(mockCodeIndexManagerDisabled)

		// Check parameter inference guidance in both cases
		for (const objective of [objectiveEnabled, objectiveDisabled]) {
			expect(objective).toContain("Go through each of the required parameters")
			expect(objective).toContain(
				"determine if the user has directly provided or given enough information to infer a value",
			)
			expect(objective).toContain("DO NOT invoke the tool (not even with fillers for the missing params)")
			expect(objective).toContain("ask_followup_question tool")
		}
	})

	it("should include task decomposition strategy section", () => {
		const objectiveEnabled = getObjectiveSection(mockCodeIndexManagerEnabled)
		const objectiveDisabled = getObjectiveSection(mockCodeIndexManagerDisabled)

		// Check that task decomposition strategy is included in both cases
		for (const objective of [objectiveEnabled, objectiveDisabled]) {
			expect(objective).toContain("## Task Decomposition Strategy")
			expect(objective).toContain("When facing a complex task, choose the appropriate decomposition approach:")
		}
	})

	it("should explain when to use TODO list vs subtasks", () => {
		const objective = getObjectiveSection(mockCodeIndexManagerEnabled)

		// Check TODO list guidance
		expect(objective).toContain("**Use TODO List (update_todo_list) when:**")
		expect(objective).toContain("same mode")
		expect(objective).toContain("share the same context")
		expect(objective).toContain("fine-grained progress tracking")
		expect(objective).toContain("moderately complex")

		// Check subtask guidance
		expect(objective).toContain("**Create Subtasks (new_task) when:**")
		expect(objective).toContain("switch modes")
		expect(objective).toContain("clearly separated stages")
		expect(objective).toContain("different expertise")
		expect(objective).toContain("independent task management")
		expect(objective).toContain("**boundaries**")
	})

	it("should recommend hybrid approach for complex tasks", () => {
		const objective = getObjectiveSection(mockCodeIndexManagerEnabled)

		// Check hybrid approach guidance
		expect(objective).toContain("**Hybrid Approach (Recommended for Complex Tasks):**")
		expect(objective).toContain("Create subtasks with `new_task` for major phases with different modes")
		expect(objective).toContain("Within each subtask, use `update_todo_list` to track detailed steps")
		expect(objective).toContain("high-level separation and fine-grained progress tracking")
	})

	it("should include concrete examples for task decomposition", () => {
		const objective = getObjectiveSection(mockCodeIndexManagerEnabled)

		// Check that examples are included
		expect(objective).toContain("Example:")
		expect(objective).toContain("Implement user login feature")
		expect(objective).toContain("Build a complete API")
	})
})
