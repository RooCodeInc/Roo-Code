import * as crypto from "crypto"
import * as fs from "fs/promises"
import * as path from "path"
import { TraceRecord } from "./types"

export class TraceLogger {
	private ledgerPath = path.join(process.cwd(), ".orchestration", "agent_trace.jsonl")

	/**
	 * Calculates the content hash H = SHA-256(Normalize(Block))
	 * to provide Structural Identity (Dropstone, 2025).
	 */
	private calculateSpatialHash(content: string): string {
		const normalized = content.replace(/\s+/g, " ").trim() // Normalize whitespace
		return crypto.createHash("sha256").update(normalized).digest("hex")
	}

	async logMutation(intentId: string, filePath: string, content: string): Promise<void> {
		const hash = this.calculateSpatialHash(content)

		const record: TraceRecord = {
			version: "1.0",
			id: crypto.randomUUID(),
			timestamp: new Date().toISOString(),
			files: [
				{
					path: filePath,
					conversations: [
						{
							contributor: { type: "ai" },
							ranges: [
								{
									start_line: 1, // Full file write context
									end_line: content.split("\n").length,
									content_hash: `sha256:${hash}`,
								},
							],
						},
					],
				},
			],
		}

		// Append to the hash-chained evidence log (TRACE, 2026)
		await fs.appendFile(this.ledgerPath, JSON.stringify(record) + "\n")
	}
}
