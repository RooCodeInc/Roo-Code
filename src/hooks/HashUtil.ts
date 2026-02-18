import { createHash } from "crypto"

export class HashUtil {
	static sha256(content: string): string {
		return createHash("sha256").update(content).digest("hex")
	}
}
