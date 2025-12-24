import { inspectTreeStructure, debugLog } from "./helpers"
import { sampleBashContent } from "./fixtures/sample-bash"

describe("Inspect Bash", () => {
	it("should capture Bash-specific constructs", async () => {
		const result = await inspectTreeStructure(sampleBashContent, "bash")
		debugLog("Bash Inspect Result:", result)

		// Check for function definitions
		expect(result).toContain("function_definition")

		// Check for variable assignments
		expect(result).toContain("variable_assignment")

		// Check for command structures
		expect(result).toContain("command")

		// Check for control flow structures
		expect(result).toContain("case_statement")
		expect(result).toContain("if_statement")
		expect(result).toContain("while_statement")
		expect(result).toContain("for_statement")

		// Check for test commands
		expect(result).toContain("test_command")

		// Check for arithmetic operations
		expect(result).toContain("arithmetic_expansion")

		// Check for here documents
		expect(result).toContain("heredoc_redirect")

		// Check for pipelines
		expect(result).toContain("pipeline")

		// Check for redirections
		expect(result).toContain("redirect")

		// Check for arrays
		expect(result).toContain("array")

		// Check for command substitution
		expect(result).toContain("command_substitution")

		// Check for program structure
		expect(result).toContain("program")

		// The shebang appears as a comment in the tree
		expect(result).toContain("comment")
	})
})
