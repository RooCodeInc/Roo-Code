import crypto from "crypto"

export class ContentHasher {
	static hash(content: string): string {
		return crypto.createHash("sha256").update(content).digest("hex")
	}
}
