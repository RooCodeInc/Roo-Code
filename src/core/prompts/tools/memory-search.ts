import { ToolArgs } from "./types"

export function getMemorySearchDescription(args: ToolArgs): string {
	return `## memory_search
Description: Search conversation memory for past technical decisions, patterns, and project context. Retrieves relevant memories about infrastructure, architecture, debugging issues, and learned patterns for the current workspace.

Parameters:
- query: (required) Natural language search query. Use the user's exact wording when possible.
- category: (optional) Filter by category: infrastructure, architecture, pattern, or debugging
- tags: (optional) Comma-separated tags to filter results (e.g., "auth,cookies")
- limit: (optional) Maximum number of results to return (default: 10)

Usage:
<memory_search>
<query>Your natural language query here</query>
<category>architecture</category>
<tags>auth,cookies</tags>
<limit>6</limit>
</memory_search>

Examples:

1. Search for authentication decisions:
<memory_search>
<query>authentication approach</query>
<category>architecture</category>
</memory_search>

2. Find debugging patterns:
<memory_search>
<query>CORS error fixes</query>
<category>pattern</category>
</memory_search>

3. General project context search:
<memory_search>
<query>database configuration</query>
</memory_search>

Output format:
ARCHITECTURE: Database access via dependency injection (replaces singleton) (2025-07-08)
PATTERN: Avoid N+1 queries in SQLAlchemy using selectinload (derived from incident) (2025-05-21)
`
}
