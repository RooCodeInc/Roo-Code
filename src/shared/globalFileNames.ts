export const GlobalFileNames = {
	apiConversationHistory: "api_conversation_history.json",
	uiMessages: "ui_messages.json",
	mcpSettings: "mcp_settings.json",
	customModes: "custom_modes.yaml",
	taskMetadata: "task_metadata.json",
	lwcInstructions: "code/lwc-guide.md",
	apexInstructions: "code/apex-guide.md",
	asynchronousApexInstructions: "code/asynchronous-apex-guide.md",
	// Salesforce Agent Instructions
	assignmentRulesInstructions: "Salesforce_Agent/assignment-rules.md",
	customFieldInstructions: "Salesforce_Agent/custom-field.md",
	customObjectInstructions: "Salesforce_Agent/custom-object.md",
	fieldPermissionsInstructions: "Salesforce_Agent/field-permissions.md",
	objectPermissionsInstructions: "Salesforce_Agent/object-permission.md",
	pathCreationInstructions: "Salesforce_Agent/path-creation.md",
	profileInstructions: "Salesforce_Agent/profile.md",
	recordTypesInstructions: "Salesforce_Agent/record-types.md",
	roleCreationInstructions: "Salesforce_Agent/role-creation.md",
	validationRulesInstructions: "Salesforce_Agent/validation-rules.md",
	// Visual Force & Aura Components
	visualForceInstructions: "code/visual-force.md",
	auraComponentsInstructions: "code/aura-components.md",
	// PMD Rules Instructions
	pmdApexInstructions: "pmd/PMD_Apex_Rules.md",
	pmdHtmlInstructions: "pmd/PMD_HTML_Rules.md",
	pmdJavaScriptInstructions: "pmd/PMD_JavaScript_Rules.md",
	pmdVisualforceInstructions: "pmd/PMD_Visualforce_Rules.md",
	pmdXmlInstructions: "pmd/PMD_XML_Rules.md",
}

/**
 * Task type configuration for get_task_guides tool
 * Maps user-friendly task types to internal instruction keys
 */
export interface TaskTypeConfig {
	instructions: string[]
	description: string
	mode: "salesforce-agent" | "code" | "orchestrator"
}

export const TaskTypeMapping: Record<string, TaskTypeConfig> = {
	// LWC Tasks
	"create-lwc": {
		instructions: ["create_lwc"],
		description: "Create Lightning Web Component",
		mode: "code",
	},
	"create-lwc-with-apex": {
		instructions: ["create_lwc", "create_apex"],
		description: "Create LWC with Apex backend",
		mode: "code",
	},

	// Apex Tasks
	"create-apex": {
		instructions: ["create_apex"],
		description: "Create Apex class or trigger",
		mode: "code",
	},
	"create-async-apex": {
		instructions: ["create_async_apex"],
		description: "Create asynchronous Apex (Future, Queueable, Batch, Scheduled)",
		mode: "code",
	},
	"create-invocable-apex": {
		instructions: ["invocable_apex", "create_apex"],
		description: "Create Invocable Apex for Agentforce or Flows",
		mode: "code",
	},

	// Admin/Metadata Tasks
	"create-custom-object": {
		instructions: ["custom_object", "custom_field", "page-layout", "field_permissions", "object_permissions"],
		description: "Create custom object with fields and validations",
		mode: "salesforce-agent",
	},
	"setup-profile-permissions": {
		instructions: ["profile", "object_permissions", "field_permissions"],
		description: "Setup profile with object and field permissions",
		mode: "salesforce-agent",
	},
	"create-assignment-rules": {
		instructions: ["assignment_rules"],
		description: "Create assignment rules",
		mode: "salesforce-agent",
	},
	"create-record-types": {
		instructions: ["record_types", "path_creation"],
		description: "Create record types with path",
		mode: "salesforce-agent",
	},
	"create-roles": {
		instructions: ["role_creation"],
		description: "Create role hierarchy",
		mode: "salesforce-agent",
	},
	"create-validation-rules": {
		instructions: ["validation_rules"],
		description: "Create validation rules",
		mode: "salesforce-agent",
	},

	// MCP/Modes
	"create-mcp-server": {
		instructions: ["create_mcp_server"],
		description: "Create MCP server",
		mode: "code",
	},
	"create-custom-mode": {
		instructions: ["create_mode"],
		description: "Create custom mode",
		mode: "code",
	},
}
