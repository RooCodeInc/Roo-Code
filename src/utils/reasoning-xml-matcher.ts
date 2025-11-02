import { XmlMatcher, XmlMatcherResult } from "./xml-matcher"

/**
 * A wrapper around XmlMatcher that can match multiple tag names for reasoning blocks.
 * This handles <think>, <thinking>, <reasoning>, and <thought> tags uniformly.
 *
 * It works by using a single XmlMatcher configured to match the shortest tag name
 * and then validates if the full tag is one of the reasoning variants.
 */
export class ReasoningXmlMatcher<Result = XmlMatcherResult> {
	private reasoningTags = ["think", "thinking", "reasoning", "thought"]
	private results: Result[] = []
	private buffer = ""
	private isProcessing = false

	constructor(
		private readonly transform?: (chunks: XmlMatcherResult) => Result,
		private readonly position = 0,
	) {}

	private processWithTag(input: string, tagName: string): XmlMatcherResult[] {
		const matcher = new XmlMatcher(tagName, undefined, this.position)
		return matcher.final(input)
	}

	private extractMatchedResults(input: string): Result[] {
		// Try each tag type to find matches
		for (const tag of this.reasoningTags) {
			// Check if the input contains this tag
			if (input.includes(`<${tag}>`) || input.includes(`</${tag}>`)) {
				const results = this.processWithTag(input, tag)
				if (results.length > 0) {
					// Transform results if needed
					if (this.transform) {
						return results.map(this.transform)
					}
					return results as Result[]
				}
			}
		}

		// No reasoning tags found, return the input as unmatched
		const unmatchedResult: XmlMatcherResult = {
			matched: false,
			data: input,
		}

		if (this.transform) {
			return [this.transform(unmatchedResult)]
		}
		return [unmatchedResult as Result]
	}

	update(chunk: string): Result[] {
		this.buffer += chunk
		this.results = []

		// Don't process until we have a complete tag or enough content
		// This prevents partial processing issues
		if (!this.buffer.includes(">")) {
			return this.results
		}

		// Check if we have any complete reasoning blocks
		let hasCompleteBlock = false
		for (const tag of this.reasoningTags) {
			const openTag = `<${tag}>`
			const closeTag = `</${tag}>`
			if (this.buffer.includes(openTag) && this.buffer.includes(closeTag)) {
				const openIndex = this.buffer.indexOf(openTag)
				const closeIndex = this.buffer.indexOf(closeTag, openIndex)
				if (closeIndex > openIndex) {
					hasCompleteBlock = true
					break
				}
			}
		}

		// If we have a complete block, process it
		if (hasCompleteBlock) {
			const results = this.extractMatchedResults(this.buffer)
			this.buffer = ""
			this.results = results
		}

		return this.results
	}

	final(chunk?: string): Result[] {
		if (chunk) {
			this.buffer += chunk
		}

		if (this.buffer.length === 0) {
			return []
		}

		const results = this.extractMatchedResults(this.buffer)
		this.buffer = ""
		return results
	}
}
