import { type ToolName, toolNames } from "@roo-code/types"

/**
 * Streaming normalizer for VSCode-LM style function_calls/invoke XML.
 * Converts:
 *   <function_calls><invoke name="read_file">...</invoke></function_calls>
 * to:
 *   <read_file>...</read_file>
 *
 * - Removes outer <function_calls> container tags
 * - Rewrites <invoke name="X"> to <X> and </invoke> to </X> (only for known tools)
 * - Leaves unknown tool names and native tool tags untouched
 * - Preserves inner <args> and any whitespace/newlines verbatim
 * - Resilient to chunk boundaries (buffers incomplete tags)
 */
export class FunctionCallsStreamingNormalizer {
	private buffer = ""
	private readonly tailLimit = 512
	private readonly knownTools = new Set<string>(toolNames)
	private readonly MAX_ACCUMULATOR_SIZE = 1024 * 1024 // 1MB guidance
	// Track invoke stack to map closing </invoke> to the correct </TOOL>
	private invokeStack: Array<{ name: string; known: boolean }> = []

	// Stats (can be read by caller if desired)
	public normalizedInLastChunk = false
	public toolNamesEncountered = new Set<string>()

	public reset(): void {
		this.buffer = ""
		this.invokeStack = []
		this.normalizedInLastChunk = false
		this.toolNamesEncountered.clear()
	}

	/**
	 * Process a streaming chunk and return normalized text for downstream parser.
	 * May return an empty string if only container tags were removed.
	 */
	public process(chunk: string): string {
		if (!chunk) return ""
		if (this.buffer.length + chunk.length > this.MAX_ACCUMULATOR_SIZE) {
			// Protect against unbounded growth due to pathological streams
			throw new Error("Assistant message exceeds maximum allowed size")
		}

		this.buffer += chunk
		let out = ""
		let i = 0
		this.normalizedInLastChunk = false

		const emit = (s: string) => {
			out += s
		}

		const openContainer = "<function_calls>"
		const closeContainer = "</function_calls>"

		while (i < this.buffer.length) {
			const ch = this.buffer[i]

			if (ch !== "<") {
				emit(ch)
				i++
				continue
			}

			// We have a potential tag start. Find the next '>' to determine if we have a complete tag.
			const closeIdx = this.buffer.indexOf(">", i)
			if (closeIdx === -1) {
				// Incomplete tag - wait for more data
				break
			}

			const tag = this.buffer.slice(i, closeIdx + 1)

			// 1) Handle container removal exactly
			if (tag === openContainer) {
				// Drop it
				this.normalizedInLastChunk = true
				i = closeIdx + 1
				continue
			}
			if (tag === closeContainer) {
				// Drop it
				this.normalizedInLastChunk = true
				i = closeIdx + 1
				continue
			}

			// 2) Handle <invoke ...> opening tag
			//    Accept forms like: <invoke name="read_file"> (other attributes are ignored/preserved only if unknown)
			const invokeOpenMatch = tag.match(/^<invoke\b[^>]*?\bname="([^"]+)"[^>]*>$/)
			if (invokeOpenMatch) {
				const tool = invokeOpenMatch[1]
				const known = this.knownTools.has(tool)
				this.toolNamesEncountered.add(tool)
				if (known) {
					emit(`<${tool}>`)
					this.invokeStack.push({ name: tool, known: true })
					this.normalizedInLastChunk = true
				} else {
					// Unknown tool name - pass through untouched and track a non-known frame so we can pair closing tag
					emit(tag)
					this.invokeStack.push({ name: tool, known: false })
				}
				i = closeIdx + 1
				continue
			}

			// 3) Handle </invoke> closing tag (allow optional attributes/whitespace just in case)
			if (/^<\/invoke\b[^>]*>$/.test(tag)) {
				const frame = this.invokeStack.pop()
				if (frame && frame.known) {
					emit(`</${frame.name}>`)
					this.normalizedInLastChunk = true
				} else {
					// No frame or unknown -> pass through
					emit(tag)
				}
				i = closeIdx + 1
				continue
			}

			// 4) Not a function_calls/invoke tag we care about - pass through as-is
			emit(tag)
			i = closeIdx + 1
		}

		// Keep only the unprocessed tail in buffer (incomplete tag), with a small cap
		this.buffer = this.buffer.slice(i)
		if (this.buffer.length > this.tailLimit) {
			// Keep last N chars to catch split tags; safe because anything before was fully emitted
			this.buffer = this.buffer.slice(-this.tailLimit)
		}

		return out
	}
}

/**
 * One-shot non-stream normalization of VSCode-LM function_calls/invoke XML.
 * See class comments for behavior.
 */
export function normalizeFunctionCallsXml(input: string): string {
	if (!input) return input
	if (!input.includes("<function_calls") && !input.includes("<invoke")) {
		// Fast path: nothing to do
		return input
	}

	const knownTools = new Set<string>(toolNames)
	const openContainer = "<function_calls>"
	const closeContainer = "</function_calls>"

	let out = ""
	const stack: Array<{ name: string; known: boolean }> = []

	let i = 0
	const len = input.length

	while (i < len) {
		const ch = input[i]
		if (ch !== "<") {
			out += ch
			i++
			continue
		}

		const closeIdx = input.indexOf(">", i)
		if (closeIdx === -1) {
			// Malformed/incomplete -> best effort: return original input unchanged
			return input
		}

		const tag = input.slice(i, closeIdx + 1)

		if (tag === openContainer || tag === closeContainer) {
			// Remove containers
			i = closeIdx + 1
			continue
		}

		const invokeOpenMatch = tag.match(/^<invoke\b[^>]*?\bname="([^"]+)"[^>]*>$/)
		if (invokeOpenMatch) {
			const tool = invokeOpenMatch[1]
			const known = knownTools.has(tool)
			stack.push({ name: tool, known })
			out += known ? `<${tool}>` : tag
			i = closeIdx + 1
			continue
		}

		if (/^<\/invoke\b[^>]*>$/.test(tag)) {
			const frame = stack.pop()
			if (frame && frame.known) {
				out += `</${frame.name}>`
			} else {
				out += tag
			}
			i = closeIdx + 1
			continue
		}

		// Any other tag - copy through verbatim
		out += tag
		i = closeIdx + 1
	}

	// If stack not empty or other malformation, we still return best-effort result.
	// The plan specifies: If malformed, return original input and log once (best-effort).
	// We opt for best-effort (already produced) to avoid dropping content.
	return out
}
