export interface SquareBracketMatcherResult {
	matched: boolean
	data: string
}

/**
 * Matcher for square bracket tags like [THINK]...[/THINK]
 * Used by models like Magistral that use square bracket syntax instead of angle brackets
 */
export class SquareBracketMatcher<Result = SquareBracketMatcherResult> {
	private buffer = ""
	private insideTag = false
	private tagDepth = 0
	private results: Result[] = []

	constructor(
		readonly tagName: string,
		readonly transform?: (chunks: SquareBracketMatcherResult) => Result,
		readonly position = 0,
	) {}

	private emit(matched: boolean, data: string) {
		if (!data) return
		const chunk: SquareBracketMatcherResult = { matched, data }
		this.results.push(this.transform ? this.transform(chunk) : (chunk as Result))
	}

	private processComplete() {
		const openTag = `[${this.tagName}]`
		const closeTag = `[/${this.tagName}]`
		let processed = false

		while (true) {
			if (!this.insideTag) {
				// Look for opening tag
				const openIndex = this.buffer.indexOf(openTag)
				if (openIndex === -1) {
					// No opening tag found
					break
				}

				if (openIndex > 0) {
					// Emit text before tag
					this.emit(false, this.buffer.substring(0, openIndex))
					this.buffer = this.buffer.substring(openIndex)
					processed = true
				}

				// Now we have opening tag at start
				this.buffer = this.buffer.substring(openTag.length)
				this.insideTag = true
				this.tagDepth = 1
				processed = true
			} else {
				// Inside tag, look for closing tag
				let pos = 0
				let contentStart = 0

				while (pos < this.buffer.length) {
					const nextOpen = this.buffer.indexOf(openTag, pos)
					const nextClose = this.buffer.indexOf(closeTag, pos)

					if (nextClose === -1) {
						// No closing tag found yet
						break
					}

					if (nextOpen !== -1 && nextOpen < nextClose) {
						// Found nested opening tag
						this.tagDepth++
						pos = nextOpen + openTag.length
					} else {
						// Found closing tag
						this.tagDepth--
						if (this.tagDepth === 0) {
							// Complete match found
							const content = this.buffer.substring(contentStart, nextClose)
							this.emit(true, content)
							this.buffer = this.buffer.substring(nextClose + closeTag.length)
							this.insideTag = false
							processed = true
							break
						} else {
							// Still nested
							pos = nextClose + closeTag.length
						}
					}
				}

				if (this.insideTag) {
					// Still inside tag, no complete match yet
					break
				}
			}
		}

		return processed
	}

	update(chunk: string): Result[] {
		this.buffer += chunk
		this.results = []

		// Process any complete tag pairs
		this.processComplete()

		// For streaming, only emit unmatched text if we're sure it won't be part of a tag
		if (!this.insideTag && this.buffer && !this.buffer.includes("[")) {
			// No potential tags, emit as text
			this.emit(false, this.buffer)
			this.buffer = ""
		}

		const results = this.results
		this.results = []
		return results
	}

	final(chunk?: string): Result[] {
		if (chunk) {
			this.buffer += chunk
		}

		this.results = []

		// Process any remaining complete pairs
		this.processComplete()

		// Emit any remaining buffer
		if (this.buffer) {
			this.emit(this.insideTag, this.buffer)
			this.buffer = ""
		}

		const results = this.results
		this.results = []
		this.insideTag = false
		this.tagDepth = 0
		return results
	}
}
