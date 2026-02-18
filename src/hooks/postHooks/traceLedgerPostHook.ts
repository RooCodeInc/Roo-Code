import * as fs from "fs"
import * as path from "path"
import { PostHook } from "../interfaces"
import { sha256 } from "../utils/contentHash"

export function traceLedgerPostHook(root: string): PostHook {
	return {
		async onPostWrite({ path: relPath, content, intentId, mutationClass }) {
			const ledger = path.join(root, ".orchestration/agent_trace.jsonl")
			const entry = {
				id: simpleUUID(),
				timestamp: new Date().toISOString(),
				files: [
					{
						relative_path: relPath,
						ranges: [{ start_line: 0, end_line: 0, content_hash: sha256(content) }],
						related: [{ type: "specification", value: intentId }],
						mutation_class: mutationClass,
					},
				],
			}
			fs.appendFileSync(ledger, JSON.stringify(entry) + "\n")
		},
	}
}
function simpleUUID() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0,
			v = c === "x" ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}
