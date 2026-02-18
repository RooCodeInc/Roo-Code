/**
 * Generates the fetch_instructions tool description.
 * @param enableMcpServerCreation - Whether to include MCP server creation task.
 *                                  Defaults to true when undefined.
 * @param enablePmdRules - Whether to include PMD rules tasks.
 *                        Defaults to true when undefined.
 */
export function getFetchInstructionsDescription(enableMcpServerCreation?: boolean, enablePmdRules?: boolean): string {
	const baseTasks =
		enableMcpServerCreation !== false
			? `  create_mcp_server
  create_mode
  create_lwc
  create_apex
  create_async_apex
  create_visual_force
  create_aura_components
  assignment_rules
  invocable_apex
  custom_field
  custom_object
  field_permissions
  object_permissions
  path_creation
  profile
  record_types
  role_creation
  validation_rules
  workflow_field_update_creation
  workflow_email_alert_creation`
			: `  create_mode
  create_lwc
  create_apex
  create_async_apex
  create_visual_force
  create_aura_components
  assignment_rules
  invocable_apex
  custom_field
  custom_object
  field_permissions
  object_permissions
  path_creation
  profile
  record_types
  role_creation
  validation_rules
  workflow_field_update_creation
  workflow_email_alert_creation`

	const pmdTasks =
		enablePmdRules !== false
			? `  pmd_apex
  pmd_html
  pmd_javascript
  pmd_visualforce
  pmd_xml`
			: ``

	const mcpTask = enableMcpServerCreation !== false ? `  create_mcp_server` : ``

	const tasks = [mcpTask, baseTasks, pmdTasks].filter((t) => t.trim()).join("\n")

	const mcpExample =
		enableMcpServerCreation !== false
			? `Example: Requesting instructions to create an MCP Server

<fetch_instructions>
<task>create_mcp_server</task>
</fetch_instructions>

`
			: ``

	const pmdExample =
		enablePmdRules !== false
			? `Example: Requesting PMD Apex Rules instructions

<fetch_instructions>
<task>pmd_apex</task>
</fetch_instructions>

Example: Requesting instructions to create a Visualforce Page

<fetch_instructions>
<task>create_visual_force</task>
</fetch_instructions>

Example: Requesting instructions to create Aura Components

<fetch_instructions>
<task>create_aura_components</task>
</fetch_instructions>

Example: Requesting instructions for Salesforce Assignment Rules

<fetch_instructions>
<task>assignment_rules</task>
</fetch_instructions>

Example: Requesting PMD JavaScript Rules instructions

<fetch_instructions>
<task>pmd_javascript</task>
</fetch_instructions>


`
			: ``

	const example = `${mcpExample}Example: Requesting instructions to create a Lightning Web Component

<fetch_instructions>
<task>create_lwc</task>
</fetch_instructions>

Example: Requesting instructions to create an Apex class

<fetch_instructions>
<task>create_apex</task>
</fetch_instructions>

Example: Requesting instructions for Asynchronous Apex (Future, Queueable, Batch, Scheduled)

<fetch_instructions>
<task>create_async_apex</task>
</fetch_instructions>

Example: Requesting instructions for Salesforce Custom Object

<fetch_instructions>
<task>custom_object</task>
</fetch_instructions>

Example: Requesting instructions for Salesforce Custom Field

<fetch_instructions>
<task>custom_field</task>
</fetch_instructions>

${pmdExample}`

	return `## fetch_instructions
Description: Request to fetch instructions to perform a task
Parameters:
- task: (required) The task to get instructions for.  This can take the following values:
${tasks}
- section: (optional) The specific section to retrieve. Can be:
  - "toc" or "table of contents" - Get table of contents with section numbers
  - A section number (e.g., "5", "12") - Get specific section by number
  - A section title (e.g., "SOQL & SOSL", "Event Handling") - Get specific section by title
  - Omit to get full guide summary with TOC (default behavior)

${example}

Example: Requesting table of contents for Apex guide

<fetch_instructions>
<task>create_apex</task>
<section>toc</section>
</fetch_instructions>

Example: Requesting specific section by number

<fetch_instructions>
<task>create_apex</task>
<section>5</section>
</fetch_instructions>

Example: Requesting specific section by title

<fetch_instructions>
<task>create_lwc</task>
<section>Event Handling</section>
</fetch_instructions>`
}
