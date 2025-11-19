import { ToolArgs } from "./types"

export function getCodebaseSearchDescription(args: ToolArgs): string {
	return `## codebase_search
Description: Find code most relevant to your search query using semantic search. This tool understands code meaning and context, not just keywords, making it ideal for exploring unfamiliar codebases. Use natural language queries to find implementations, patterns, and concepts.

**How It Works:**
- Uses AI-powered semantic search to understand code meaning
- Searches based on concepts and intent, not just exact text matches
- Returns ranked results with relevance scores (0-1, higher is better)
- Searches entire workspace by default, or specific subdirectories

**What You Can Find:**
- Specific symbols: "UserService class", "authenticate function", "API_KEY constant"
- Concepts & logic: "user authentication flow", "database connection pooling", "error handling"
- Implementations: "how to hash passwords", "JWT token validation", "file upload handling"
- Patterns: "React components with hooks", "Express middleware", "async error handling"

**Results Include:**
- File path and line numbers (start/end)
- Relevance score (>0.8 = highly relevant, 0.6-0.8 = relevant, <0.6 = tangential)
- Code chunk with context
- Symbol information (function/class name, type like "function_definition" or "class_definition")
- Language (inferred from file extension)

**Best Practices:**
- Use natural language: "user authentication logic" not "auth.*user"
- Be specific but not overly narrow: "JWT token generation" not "line 45 in auth.ts"
- Reuse the user's exact wording when they ask questions - their phrasing helps semantic search
- Start broad, then refine based on results
- Queries MUST be in English (translate if needed)

Parameters:
- query: (required) Natural language search query describing what you're looking for
- path: (optional) Limit search to specific subdirectory (relative to ${args.cwd}). Leave empty for entire workspace.

Usage:
<codebase_search>
<query>Your natural language query here</query>
<path>Optional subdirectory path</path>
</codebase_search>

Examples:
<codebase_search>
<query>User authentication with JWT tokens</query>
<path>src/auth</path>
</codebase_search>

<codebase_search>
<query>how to validate email addresses</query>
</codebase_search>

<codebase_search>
<query>React components that use useState hook</query>
<path>src/components</path>
</codebase_search>
`
}
