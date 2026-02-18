import * as crypto from "crypto"

export function computeContentHash(content: string): string {
	return crypto.createHash("sha256").update(content).digest("hex")
}
