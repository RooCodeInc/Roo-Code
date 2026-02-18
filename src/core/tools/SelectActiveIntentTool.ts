import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "js-yaml"
import { Task } from "../task/Task"
import { ToolUse, ToolResponse } from "../../shared/tools"

export class SelectActiveIntentTool {
	static async handle(
		cline: Task,
		block: ToolUse<"select_active_intent">,
		options: {
			askApproval: any
			handleError: any
			pushToolResult: (content: ToolResponse) => void
		},
	) {
		// --- ROBUST EXTRACTOR ---
		let intent_id = ""

		// 1. Try nativeArgs (The standard way)
		if (block.nativeArgs && block.nativeArgs.intent_id) {
			intent_id = String(block.nativeArgs.intent_id)
		}
		// 2. Try raw params (The fallback way)
		else if (block.params && block.params.intent_id) {
			intent_id = String(block.params.intent_id)
		}
		// 3. Try to extract from the raw block object (emergency fallback)
		else if ((block as any).arguments) {
			try {
				const rawArgs =
					typeof (block as any).arguments === "string"
						? JSON.parse((block as any).arguments)
						: (block as any).arguments
				intent_id = rawArgs.intent_id || ""
			} catch (e) {
				console.log("⚠️ [IntentTool] Manual JSON parse failed")
			}
		}
		// 4. Last resort: check if params.arguments exists (for some parser formats)
		else if (block.params && (block.params as any).arguments) {
			try {
				const rawArgs =
					typeof (block.params as any).arguments === "string"
						? JSON.parse((block.params as any).arguments)
						: (block.params as any).arguments
				intent_id = rawArgs.intent_id || ""
			} catch (e) {
				console.log("⚠️ [IntentTool] Params.arguments parse failed")
			}
		}

		// Clean the ID
		intent_id = intent_id.trim().replace(/['"]/g, "")

		if (!intent_id) {
			console.error("❌ [IntentTool] No intent_id found in any format")
			options.pushToolResult("ERROR: No intent_id provided. Please specify an intent_id parameter.")
			return
		}

		const cwd = cline.cwd
		const orchestrationPath = path.join(cwd, ".orchestration", "active_intents.yaml")

		// DEBUG LOGS: These appear in your Window A Debug Console
		console.log(`🔍 [IntentTool] Searching for ID: "${intent_id}"`)
		console.log(`📂 [IntentTool] Looking in: ${orchestrationPath}`)

		try {
			// 2. Check if file exists first
			await fs.access(orchestrationPath)
			const fileContent = await fs.readFile(orchestrationPath, "utf-8")

			// 3. Parse YAML
			const data = yaml.load(fileContent) as any

			if (!data || !data.active_intents) {
				options.pushToolResult(`ERROR: YAML is empty or missing 'active_intents' key.`)
				return
			}

			// 4. Find the intent (Case-Insensitive matching for safety)
			const intent = data.active_intents.find((i: any) => String(i.id).toLowerCase() === intent_id.toLowerCase())

			if (!intent) {
				const availableIds = data.active_intents.map((i: any) => i.id).join(", ")
				console.log(`❌ [IntentTool] ID not found. Available IDs: ${availableIds}`)
				options.pushToolResult(
					`ERROR: Intent ID '${intent_id}' not found. Available IDs in file: ${availableIds}`,
				)
				return
			}

			// 5. SUCCESS: Store the ID in the Task State (The Key for the Gatekeeper)
			cline.activeIntentId = intent.id
			console.log(`✅ [IntentTool] Successfully matched Intent: ${cline.activeIntentId}`)

			// 6. Format the Injection Context
			const result = `
[INTENT LOADED]
ID: ${intent.id}
Name: ${intent.name}
Constraints: ${Array.isArray(intent.constraints) ? intent.constraints.join("; ") : intent.constraints}
Scope: ${Array.isArray(intent.owned_scope) ? intent.owned_scope.join(", ") : intent.owned_scope}

Confirmed. You are now authorized to proceed with this intent. The Gatekeeper has been unlocked.`

			options.pushToolResult(result)
		} catch (error: any) {
			console.error(`🚨 [IntentTool] File Error:`, error.message)
			if (error.code === "ENOENT") {
				options.pushToolResult(
					`ERROR: File not found at ${orchestrationPath}. Please ensure the .orchestration folder exists in the project root.`,
				)
			} else {
				await options.handleError("loading intent", error)
			}
		}
	}
}
