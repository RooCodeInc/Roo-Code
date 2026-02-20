export type PromptVariables = {
	workspace?: string
	extensionPath?: string
	globalStoragePath?: string
	mode?: string
	language?: string
	shell?: string
	operatingSystem?: string
}

/**
 * Loads custom system prompt instructions based on mode.
 * - Orchestrator: No task guides (plans and delegates only)
 * - Specialized modes: Must load task guides before execution
 */
export async function loadCustomPromptIndexFile(cwd: string, variables: PromptVariables): Promise<string> {
	// Orchestrator mode should NOT load task guides - it only plans and delegates
	if (variables.mode === "orchestrator") {
		return `**ORCHESTRATOR WORKFLOW:**

You are a strategic coordinator. You do NOT execute tasks directly.

**Your Role:**
1. Analyze the user's request and break it into subtasks
2. Create a planning file at \`.siid-code/planning/[name]-plan.md\`
3. Delegate subtasks to specialized modes using \`new_task\` tool

**Delegation Guidelines:**
- Use \`salesforce-agent\` mode for: Objects, fields, profiles, permissions, flows, Agentforce, admin config
- Use \`code\` mode for: Apex, LWC, triggers, test classes, development

**IMPORTANT:** Do NOT use \`get_task_guides\` - the specialized modes will load their own guides.

**Example Delegation:**
<new_task>
<mode>salesforce-agent</mode>
<message>Create the Customer_Feedback__c custom object with required fields. Update planning file with your progress.</message>
</new_task>`
	}

	// Specialized modes (salesforce-agent, code, etc.) - must load task guides
	return `**IMPORTANT: Before starting any task, you MUST use the 'get_task_guides' tool to load all required instructions.

**Workflow for Subtasks:**
1. Use \`get_task_guides\` to load instructions for your task type
2. Read the planning file if it exists (check \`.siid-code/planning/\`)
3. Update the planning file with detailed steps from the loaded guides
4. Execute the task following the guide workflow
5. Update planning file with progress/completion

**Available Task Types:**

| Task Type | Description |
|-----------|-------------|
| create-lwc | Create Lightning Web Component |
| create-lwc-with-apex | Create LWC with Apex backend |
| create-apex | Create Apex class or trigger |
| create-invocable-apex | Create Invocable Apex for Agentforce or Flows |
| create-custom-object | Create custom object with fields and validations |
| setup-profile-permissions | Setup profile with object and field permissions |
| create-assignment-rules | Create assignment rules |
| create-record-types | Create record types with path |
| create-roles | Create role hierarchy |
| create-validation-rules | Create validation rules |
| create-adaptive-agent | Create Adaptive Response Agent |
| create-mcp-server | Create MCP server |
| create-custom-mode | Create custom mode |

**Example Usage:**

<get_task_guides>
<task_type>create-lwc-with-apex</task_type>
</get_task_guides>`
}
