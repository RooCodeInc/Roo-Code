import crypto from "crypto"

export function sha256Hex(input: string): string {
	return crypto.createHash("sha256").update(input, "utf8").digest("hex")
}

export function prefixedSha256(input: string): string {
	return `sha256:${sha256Hex(input)}`
}
