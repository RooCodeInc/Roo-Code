import * as crypto from "crypto"
import * as fs from "fs/promises"
import * as IntentState from "./intentState" // Fixed Path

export async function postToolHook(filePath: string, toolName: string): Promise<void> {
	const activeIntentId = IntentState.getActiveIntent() // Get the string ID

	if (toolName === "write_to_file" || toolName === "apply_diff") {
		try {
			const fileBuffer = await fs.readFile(filePath)
			const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex")

			const auditEntry = {
				timestamp: new Date().toISOString(),
				intent_id: activeIntentId || "UNAUTHORIZED", // Use the string directly
				tool: toolName,
				file: filePath,
				sha256: hash,
			}

			await fs.appendFile(".orchestration/agent_trace.jsonl", JSON.stringify(auditEntry) + "\n")

			console.log(`[Governance] Audit logged for ${activeIntentId}: ${hash.substring(0, 8)}`)
		} catch (error) {
			console.error("Failed to generate audit hash:", error)
		}
	}
}
