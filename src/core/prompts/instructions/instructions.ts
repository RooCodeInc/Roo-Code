import { createMCPServerInstructions } from "./create-mcp-server"
import { createModeInstructions } from "./create-mode"
import { createLWCInstructions } from "./create-lwc"
import { createApexInstructions } from "./create-apex"
import { createAsyncApexInstructions } from "./create-async-apex"
import { createVisualForceInstructions } from "./create-visual-force"
import { createAuraComponentsInstructions } from "./create-aura-components"
import {
	assignmentRulesInstructions,
	customFieldInstructions,
	customObjectInstructions,
	fieldPermissionsInstructions,
	objectPermissionsInstructions,
	pathCreationInstructions,
	profileInstructions,
	recordTypesInstructions,
	roleCreationInstructions,
	validationRulesInstructions,
} from "./salesforce-instructions"
import {
	pmdApexInstructions,
	pmdHtmlInstructions,
	pmdJavaScriptInstructions,
	pmdVisualforceInstructions,
	pmdXmlInstructions,
} from "./pmd-instructions"
import { McpHub } from "../../../services/mcp/McpHub"
import { DiffStrategy } from "../../../shared/tools"
import * as vscode from "vscode"

interface InstructionsDetail {
	mcpHub?: McpHub
	diffStrategy?: DiffStrategy
	context?: vscode.ExtensionContext
	section?: string
}

export async function fetchInstructions(text: string, detail: InstructionsDetail): Promise<string> {
	switch (text) {
		case "create_mcp_server": {
			return await createMCPServerInstructions(detail.mcpHub, detail.diffStrategy)
		}
		case "create_mode": {
			return await createModeInstructions(detail.context)
		}
		case "create_lwc": {
			return await createLWCInstructions(detail.context, detail.section)
		}
		case "create_apex": {
			return await createApexInstructions(detail.context, detail.section)
		}
		case "create_async_apex": {
			return await createAsyncApexInstructions(detail.context, detail.section)
		}
		case "create_visual_force": {
			console.log("[INSTRUCTIONS] Matched task: create_visual_force")
			const result = await createVisualForceInstructions(detail.context, detail.section)
			console.log("[INSTRUCTIONS] Visual Force instructions fetched successfully")
			return result
		}
		case "create_aura_components": {
			console.log("[INSTRUCTIONS] Matched task: create_aura_components")
			const result = await createAuraComponentsInstructions(detail.context, detail.section)
			console.log("[INSTRUCTIONS] Aura Components instructions fetched successfully")
			return result
		}
		// Salesforce Agent Instructions
		case "assignment_rules": {
			return await assignmentRulesInstructions(detail.context)
		}
		case "custom_field": {
			return await customFieldInstructions(detail.context)
		}
		case "custom_object": {
			return await customObjectInstructions(detail.context)
		}
		case "field_permissions": {
			return await fieldPermissionsInstructions(detail.context)
		}
		case "object_permissions": {
			return await objectPermissionsInstructions(detail.context)
		}
		case "path_creation": {
			return await pathCreationInstructions(detail.context)
		}
		case "profile": {
			return await profileInstructions(detail.context)
		}
		case "record_types": {
			return await recordTypesInstructions(detail.context)
		}
		case "role_creation": {
			return await roleCreationInstructions(detail.context)
		}
		case "validation_rules": {
			return await validationRulesInstructions(detail.context)
		}
		// PMD Rules Instructions
		case "pmd_apex": {
			return await pmdApexInstructions(detail.context)
		}
		case "pmd_html": {
			return await pmdHtmlInstructions(detail.context)
		}
		case "pmd_javascript": {
			return await pmdJavaScriptInstructions(detail.context)
		}
		case "pmd_visualforce": {
			return await pmdVisualforceInstructions(detail.context)
		}
		case "pmd_xml": {
			return await pmdXmlInstructions(detail.context)
		} // Code Instructions
		default: {
			return ""
		}
	}
}
