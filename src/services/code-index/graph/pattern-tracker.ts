import { createHash } from "crypto"
import { CodePattern, PatternContext, PatternSuggestion } from "./types"

/**
 * PatternTracker
 * Tracks recurring code patterns and provides similarity-based suggestions
 */
export class PatternTracker {
	private codePatterns: Map<string, CodePattern> = new Map()
	// Mock vector store - in reality this would be a proper vector database
	private vectors: Map<string, number[]> = new Map()

	/**
	 * Track a code snippet as a pattern
	 */
	async trackPattern(code: string, context: PatternContext): Promise<void> {
		const normalizedCode = this.normalizeCode(code)
		if (!normalizedCode || normalizedCode.length < 10) return // Ignore too short snippets

		const hash = this.hashPattern(normalizedCode)

		if (this.codePatterns.has(hash)) {
			const pattern = this.codePatterns.get(hash)!
			pattern.occurrences++
		} else {
			const template = this.extractTemplate(code)
			this.codePatterns.set(hash, {
				hash,
				template,
				occurrences: 1,
				firstSeen: {
					timestamp: Date.now(),
					context,
				},
				metadata: {
					complexity: this.calculateComplexity(code),
					category: this.categorizePattern(code),
				},
			})

			// Store embedding for similarity search
			const embedding = await this.embedCode(normalizedCode)
			this.vectors.set(hash, embedding)
		}
	}

	/**
	 * Find similar patterns to the given code
	 */
	async suggestSimilarPatterns(code: string): Promise<PatternSuggestion[]> {
		const normalizedCode = this.normalizeCode(code)
		if (!normalizedCode) return []

		const embedding = await this.embedCode(normalizedCode)
		const similar = await this.findSimilarEmbeddings(embedding)

		return similar.map((s) => ({
			pattern: this.codePatterns.get(s.hash)!,
			similarity: s.score,
			description: this.generateSuggestionDescription(s.hash),
		}))
	}

	/**
	 * Get most frequent patterns
	 */
	getTopPatterns(limit: number = 10): CodePattern[] {
		return Array.from(this.codePatterns.values())
			.sort((a, b) => b.occurrences - a.occurrences)
			.slice(0, limit)
	}

	// ============================================================================
	// Private Helper Methods
	// ============================================================================

	private normalizeCode(code: string): string {
		// Remove whitespace and comments for normalization
		return code
			.replace(/\/\/.*$/gm, "") // Remove line comments
			.replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments
			.replace(/\s+/g, " ") // Normalize whitespace
			.trim()
	}

	private hashPattern(code: string): string {
		return createHash("sha256").update(code).digest("hex")
	}

	private extractTemplate(code: string): string {
		// precise template extraction would need AST analysis
		// For now, we return a simplified version
		return code.trim()
	}

	private calculateComplexity(code: string): number {
		// Simple heuristic: count block openers/closers and control flow keywords
		const controlFlow = (code.match(/\b(if|for|while|switch|catch)\b/g) || []).length
		return controlFlow + 1
	}

	private categorizePattern(code: string): string {
		if (code.includes("class ")) return "class_definition"
		if (code.includes("function ")) return "function_definition"
		if (code.includes("import ")) return "import_statement"
		if (code.includes("try") && code.includes("catch")) return "error_handling"
		return "code_block"
	}

	private generateSuggestionDescription(hash: string): string {
		const pattern = this.codePatterns.get(hash)
		if (!pattern) return "Variable pattern match"
		return `Similar pattern found in ${pattern.firstSeen.context.filePath} (occurrences: ${pattern.occurrences})`
	}

	/**
	 * Mock embedding generation
	 * In a real implementation, this would call an LLM embedding API
	 */
	private async embedCode(code: string): Promise<number[]> {
		// Create a "fake" embedding based on character codes for deterministic testing
		// This is just a placeholder to simulate vector operations
		const vector = new Array(10).fill(0)
		for (let i = 0; i < code.length; i++) {
			vector[i % 10] += code.charCodeAt(i)
		}
		// Normalize
		const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
		return vector.map((v) => (magnitude === 0 ? 0 : v / magnitude))
	}

	/**
	 * Find similar vectors using cosine similarity
	 */
	private async findSimilarEmbeddings(targetVector: number[], threshold: number = 0.8): Promise<Array<{ hash: string; score: number }>> {
		const results: Array<{ hash: string; score: number }> = []

		for (const [hash, vector] of this.vectors) {
			const score = this.cosineSimilarity(targetVector, vector)
			if (score >= threshold) {
				results.push({ hash, score })
			}
		}

		return results.sort((a, b) => b.score - a.score)
	}

	private cosineSimilarity(vecA: number[], vecB: number[]): number {
		let dotProduct = 0
		let magA = 0
		let magB = 0

		for (let i = 0; i < vecA.length; i++) {
			dotProduct += vecA[i] * vecB[i]
			magA += vecA[i] * vecA[i]
			magB += vecB[i] * vecB[i]
		}

		magA = Math.sqrt(magA)
		magB = Math.sqrt(magB)

		if (magA === 0 || magB === 0) return 0
		return dotProduct / (magA * magB)
	}
}
