/**
 * Clipboard support using OSC 52 escape sequences.
 * Works in most modern terminals without requiring system clipboard access.
 */

export function copyToClipboard(text: string): void {
	const base64 = Buffer.from(text).toString("base64")
	// OSC 52 clipboard sequence: \x1b]52;c;<base64>\x07
	process.stdout.write(`\x1b]52;c;${base64}\x07`)
}

export function clearClipboard(): void {
	process.stdout.write(`\x1b]52;c;!\x07`)
}
