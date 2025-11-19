import { ToolProtocol, TOOL_PROTOCOL } from "@roo-code/types"
import { CodeIndexManager } from "../../../services/code-index/manager"
import { isNativeProtocol } from "@roo-code/types"

export function getToolUseGuidelinesSection(
	codeIndexManager?: CodeIndexManager,
	protocol: ToolProtocol = TOOL_PROTOCOL.XML,
): string {
	const isCodebaseSearchAvailable =
		codeIndexManager &&
		codeIndexManager.isFeatureEnabled &&
		codeIndexManager.isFeatureConfigured &&
		codeIndexManager.isInitialized

	// Build guidelines array with automatic numbering
	let itemNumber = 1
	const guidelinesList: string[] = []

	// First guideline is always the same
	guidelinesList.push(
		`${itemNumber++}. Assess what information you already have and what information you need to proceed with the task.`,
	)

	// Conditional codebase search guideline
	if (isCodebaseSearchAvailable) {
		guidelinesList.push(
			`${itemNumber++}. **CRITICAL: For ANY exploration of code you haven't examined yet in this conversation, you MUST use the \`codebase_search\` tool FIRST before any other search or file exploration tools.** This applies throughout the entire conversation, not just at the beginning. The codebase_search tool uses semantic search to find relevant code based on meaning rather than just keywords, making it far more effective than regex-based search_files for understanding implementations. Even if you've already explored some code, any new area of exploration requires codebase_search first.`,
		)

		// Add comprehensive codebase search guidance
		guidelinesList.push(
			`${itemNumber++}. **How to Use Codebase Search Effectively:**

   **Query Pattern Library - Use Natural Language:**

   For finding specific symbols:
   • "UserService class definition" - finds class declarations
   • "authenticate function implementation" - finds function definitions
   • "API_KEY constant declaration" - finds constant definitions
   • "UserRepository interface" - finds interface definitions

   For understanding concepts:
   • "user authentication logic" - finds auth-related code
   • "database connection pooling" - finds DB connection code
   • "error handling strategy" - finds error handling patterns
   • "JWT token validation" - finds token validation code

   For finding implementations:
   • "how to hash passwords" - finds password hashing code
   • "how to validate email addresses" - finds email validation
   • "how to handle file uploads" - finds file upload logic
   • "how to cache API responses" - finds caching implementations

   For finding patterns:
   • "React components with hooks" - finds hook usage
   • "Express middleware for validation" - finds middleware patterns
   • "async/await error handling" - finds async error patterns
   • "dependency injection examples" - finds DI patterns

   **Interpreting Search Results:**
   • Scores > 0.8: Highly relevant, likely contains what you're looking for
   • Scores 0.6-0.8: Relevant, worth examining for context
   • Scores < 0.6: May be tangentially related, use if nothing better
   • Multiple high scores: Concept implemented in multiple places - review all
   • No results or low scores: Rephrase query or try broader/narrower terms

   **Anti-Patterns - Avoid These Queries:**
   ❌ Too vague: "code", "function", "file" (no semantic meaning)
   ❌ Too specific: "line 45 in UserService.ts" (use read_file instead)
   ❌ Regex patterns: "user.*service.*auth" (use search_files instead)
   ❌ File names only: "UserService.ts" (use list_files instead)
   ❌ Multiple unrelated concepts: "auth and database and caching" (search separately)

   **Iterative Refinement Strategy:**
   1. Start broad: "user authentication" → review results
   2. Refine based on findings: "JWT token generation" → get specific code
   3. If no results: try synonyms ("login" vs "authentication", "DB" vs "database")
   4. If too many results: add specificity ("authentication in API routes")
   5. Use results to inform next query: found UserService? → search "UserService usage examples"`,
		)

		guidelinesList.push(
			`${itemNumber++}. Choose the most appropriate tool based on the task and the tool descriptions provided. After using codebase_search for initial exploration of any new code area, you may then use more specific tools like search_files (for regex patterns), list_files, or read_file for detailed examination. For example, using the list_files tool is more effective than running a command like \`ls\` in the terminal. It's critical that you think about each available tool and use the one that best fits the current step in the task.`,
		)
	} else {
		guidelinesList.push(
			`${itemNumber++}. Choose the most appropriate tool based on the task and the tool descriptions provided. Assess if you need additional information to proceed, and which of the available tools would be most effective for gathering this information. For example using the list_files tool is more effective than running a command like \`ls\` in the terminal. It's critical that you think about each available tool and use the one that best fits the current step in the task.`,
		)
	}

	// Remaining guidelines
	guidelinesList.push(
		`${itemNumber++}. If multiple actions are needed, use one tool at a time per message to accomplish the task iteratively, with each tool use being informed by the result of the previous tool use. Do not assume the outcome of any tool use. Each step must be informed by the previous step's result.`,
	)

	// Protocol-specific guideline - only add for XML protocol
	if (!isNativeProtocol(protocol)) {
		guidelinesList.push(`${itemNumber++}. Formulate your tool use using the XML format specified for each tool.`)
	}
	guidelinesList.push(`${itemNumber++}. After each tool use, the user will respond with the result of that tool use. This result will provide you with the necessary information to continue your task or make further decisions. This response may include:
  - Information about whether the tool succeeded or failed, along with any reasons for failure.
  - Linter errors that may have arisen due to the changes you made, which you'll need to address.
  - New terminal output in reaction to the changes, which you may need to consider or act upon.
  - Any other relevant feedback or information related to the tool use.`)
	guidelinesList.push(
		`${itemNumber++}. ALWAYS wait for user confirmation after each tool use before proceeding. Never assume the success of a tool use without explicit confirmation of the result from the user.`,
	)

	// Join guidelines and add the footer
	return `# Tool Use Guidelines

${guidelinesList.join("\n")}

It is crucial to proceed step-by-step, waiting for the user's message after each tool use before moving forward with the task. This approach allows you to:
1. Confirm the success of each step before proceeding.
2. Address any issues or errors that arise immediately.
3. Adapt your approach based on new information or unexpected results.
4. Ensure that each action builds correctly on the previous ones.

By waiting for and carefully considering the user's response after each tool use, you can react accordingly and make informed decisions about how to proceed with the task. This iterative process helps ensure the overall success and accuracy of your work.`
}
