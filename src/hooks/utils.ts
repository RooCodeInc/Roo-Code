import * as crypto from "crypto"

export function contentHash(content: string): string {
	return "sha256:" + crypto.createHash("sha256").update(content).digest("hex")
}

export function getOrchestrationDir(workspaceRoot: string): string {
	return `${workspaceRoot}/.orchestration`
}
