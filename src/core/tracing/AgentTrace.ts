import * as fs from "fs/promises"
import * as path from "path"
import * as crypto from "crypto"

export class AgentTrace {
	static async logChange(cwd: string, intentId: string, filePath: string, content: string, modelId: string) {
		const tracePath = path.join(cwd, ".orchestration", "agent_trace.jsonl")

		// 1. Calculate the SHA-256 hash (This is the "Spatial Independence" from the PDF)
		const contentHash = crypto.createHash("sha256").update(content).digest("hex")

		const record = {
			id: crypto.randomUUID(),
			timestamp: new Date().toISOString(),
			intent_id: intentId,
			file_path: filePath,
			content_hash: contentHash,
			model: modelId,
			vcs: { revision_id: "local-dev" }, // In a real app, this would be the Git SHA
		}

		// 2. Append to the JSONL file
		try {
			await fs.appendFile(tracePath, JSON.stringify(record) + "\n")
			console.log(`📝 [Trace] Logged change to ${filePath} for Intent ${intentId}`)
		} catch (error) {
			console.error("🚨 [Trace] Failed to write to ledger:", error)
		}
	}
}
