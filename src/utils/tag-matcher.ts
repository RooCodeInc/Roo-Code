export interface TagMatcherResult {
	matched: boolean
	data: string
}

/**
 * Streaming matcher for lightweight tag-delimited regions.
 *
 * Used to separate content inside `<tag>...</tag>` from surrounding text.
 * This is used for reasoning tags like `<think>...</think>` in provider streams.
 */
export class TagMatcher<Result = TagMatcherResult> {
	index = 0
	chunks: TagMatcherResult[] = []
	cached: string[] = []
	matched: boolean = false
	state: "TEXT" | "TAG_OPEN" | "TAG_CLOSE" = "TEXT"
	depth = 0
	pointer = 0
	readonly tagNames: string[]
	private candidates: number[] = []
	private activeTagName: string | undefined
	constructor(
		tagName: string | string[],
		readonly transform?: (chunks: TagMatcherResult) => Result,
		readonly position = 0,
	) {
		this.tagNames = Array.isArray(tagName) ? tagName : [tagName]
	}

	/**
	 * For backward compatibility, return the first tag name.
	 */
	get tagName(): string {
		return this.tagNames[0]
	}
	private collect() {
		if (!this.cached.length) {
			return
		}
		const last = this.chunks.at(-1)
		const data = this.cached.join("")
		const matched = this.matched
		if (last?.matched === matched) {
			last.data += data
		} else {
			this.chunks.push({
				data,
				matched,
			})
		}
		this.cached = []
	}
	private pop() {
		const chunks = this.chunks
		this.chunks = []
		if (!this.transform) {
			return chunks as Result[]
		}
		return chunks.map(this.transform)
	}

	/**
	 * Check if any remaining candidate tag name has the given length.
	 */
	private _anyCompletedCandidate(): boolean {
		return this.candidates.some((i) => this.tagNames[i].length === this.index)
	}

	/**
	 * Get the first completed candidate tag name (fully matched at current index).
	 */
	private _getCompletedCandidate(): string | undefined {
		for (const i of this.candidates) {
			if (this.tagNames[i].length === this.index) {
				return this.tagNames[i]
			}
		}
		return undefined
	}

	/**
	 * Filter candidates to only those matching the given char at the current index.
	 */
	private _filterCandidates(char: string): boolean {
		this.candidates = this.candidates.filter((i) => this.tagNames[i][this.index] === char)
		return this.candidates.length > 0
	}

	/**
	 * Reset candidates to all tag name indices (for open tags) or
	 * only the active tag name (for close tags).
	 */
	private _resetCandidates(closeTag: boolean) {
		if (closeTag && this.activeTagName !== undefined) {
			// For closing tags, only match the tag that was opened
			const idx = this.tagNames.indexOf(this.activeTagName)
			this.candidates = idx >= 0 ? [idx] : this.tagNames.map((_, i) => i)
		} else {
			this.candidates = this.tagNames.map((_, i) => i)
		}
	}

	private _update(chunk: string) {
		for (const char of chunk) {
			this.cached.push(char)
			this.pointer++

			if (this.state === "TEXT") {
				if (char === "<" && (this.pointer <= this.position + 1 || this.matched)) {
					this.state = "TAG_OPEN"
					this.index = 0
					this._resetCandidates(false)
				} else {
					this.collect()
				}
			} else if (this.state === "TAG_OPEN") {
				if (char === ">" && this._anyCompletedCandidate()) {
					this.state = "TEXT"
					if (!this.matched) {
						this.cached = []
					}
					this.activeTagName = this._getCompletedCandidate()
					this.depth++
					this.matched = true
				} else if (this.index === 0 && char === "/") {
					this.state = "TAG_CLOSE"
					this._resetCandidates(true)
				} else if (char === " " && (this.index === 0 || this._anyCompletedCandidate())) {
					continue
				} else if (this._filterCandidates(char)) {
					this.index++
				} else {
					this.state = "TEXT"
					this.collect()
				}
			} else if (this.state === "TAG_CLOSE") {
				if (char === ">" && this._anyCompletedCandidate()) {
					this.state = "TEXT"
					this.depth--
					this.matched = this.depth > 0
					if (!this.matched) {
						this.cached = []
						this.activeTagName = undefined
					}
				} else if (char === " " && (this.index === 0 || this._anyCompletedCandidate())) {
					continue
				} else if (this._filterCandidates(char)) {
					this.index++
				} else {
					this.state = "TEXT"
					this.collect()
				}
			}
		}
	}
	final(chunk?: string) {
		if (chunk) {
			this._update(chunk)
		}
		this.collect()
		return this.pop()
	}
	update(chunk: string) {
		this._update(chunk)
		return this.pop()
	}
}
