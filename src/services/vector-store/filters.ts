import * as path from "path"

/**
 * Translates high-level, provider-agnostic filter inputs (e.g. directory
 * prefixes, file paths) into provider-native filter objects.
 */
export abstract class FilterTranslator {
	/**
	 * Builds a provider-native filter for a directory prefix. Implementations
	 * should return undefined when no filter should be applied.
	 */
	abstract directoryPrefixToFilter(prefix?: string): any | undefined
	/**
	 * Builds a provider-native delete filter for one or many file paths.
	 * Implementations should encode exact-path matching semantics.
	 */
	abstract filePathsToDeleteFilter(filePaths: string[], workspaceRoot: string): any | undefined
}

/**
 * Qdrant implementation that expresses directory and path filters using
 * `pathSegments.N` must/should clauses.
 */
export class QdrantFilterTranslator extends FilterTranslator {
	directoryPrefixToFilter(prefix?: string): any | undefined {
		if (!prefix) return undefined

		const normalizedPrefix = path.posix.normalize(prefix.replace(/\\/g, "/"))
		if (normalizedPrefix === "." || normalizedPrefix === "./") {
			return undefined
		}
		const cleaned = path.posix.normalize(
			normalizedPrefix.startsWith("./") ? normalizedPrefix.slice(2) : normalizedPrefix,
		)
		const segments = cleaned.split("/").filter(Boolean)
		if (segments.length === 0) return undefined
		return {
			must: segments.map((segment, index) => ({
				key: `pathSegments.${index}`,
				match: { value: segment },
			})),
		}
	}

	/**
	 * Builds an OR filter across file paths, each expressed as a series of
	 * `pathSegments.N` must clauses to match the exact path.
	 */
	filePathsToDeleteFilter(filePaths: string[], workspaceRoot: string): any | undefined {
		if (filePaths.length === 0) return undefined

		const filters = filePaths.map((filePath) => {
			const relativePath = path.isAbsolute(filePath) ? path.relative(workspaceRoot, filePath) : filePath
			const normalizedRelativePath = path.normalize(relativePath)
			const segments = normalizedRelativePath.split(path.sep).filter(Boolean)
			const mustConditions = segments.map((segment, index) => ({
				key: `pathSegments.${index}`,
				match: { value: segment },
			}))
			return { must: mustConditions }
		})

		return filters.length === 1 ? filters[0] : { should: filters }
	}
}
