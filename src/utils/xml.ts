import { XMLParser } from "fast-xml-parser"

/**
 * Options for XML parsing
 */
interface ParseXmlOptions {
	/**
	 * Whether to process HTML entities (e.g., &amp; to &).
	 * Default: true for general parsing, false for diff operations
	 */
	processEntities?: boolean
}

/**
 * Parses an XML string into a JavaScript object
 * @param xmlString The XML string to parse
 * @param stopNodes Optional array of node names to stop parsing at
 * @param options Optional parsing options
 * @returns Parsed JavaScript object representation of the XML
 * @throws Error if the XML is invalid or parsing fails
 */
export function parseXml(xmlString: string, stopNodes?: string[], options?: ParseXmlOptions): unknown {
	const _stopNodes = stopNodes ?? []
	const processEntities = options?.processEntities ?? true

	try {
		// Pre-validate XML structure if stopNodes are specified
		if (_stopNodes && _stopNodes.length > 0) {
			validateXmlStructure(xmlString, _stopNodes)
		}

		const parser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: "@_",
			parseAttributeValue: false,
			parseTagValue: false,
			trimValues: true,
			processEntities,
			stopNodes: _stopNodes,
		})

		return parser.parse(xmlString)
	} catch (error) {
		// Enhance error message for better debugging
		const errorMessage = error instanceof Error ? error.message : "Unknown error"

		// Check for specific error patterns and provide helpful guidance
		if (errorMessage.includes("StopNode is not closed")) {
			const stopNodePath = _stopNodes?.join(", ") || "none"
			throw new Error(
				`Failed to parse XML: ${errorMessage}\n\n` +
					`This error typically occurs when:\n` +
					`1. The XML structure is incomplete or malformed\n` +
					`2. A tag specified in stopNodes (${stopNodePath}) is not properly closed\n` +
					`3. The XML content is truncated or cut off\n\n` +
					`Please ensure your XML is complete and all tags are properly closed.`,
			)
		}

		throw new Error(`Failed to parse XML: ${errorMessage}`)
	}
}

/**
 * Validates that XML structure has properly closed tags for stopNodes
 * @param xmlString The XML string to validate
 * @param stopNodes Array of node paths to check
 * @throws Error if validation fails
 */
function validateXmlStructure(xmlString: string, stopNodes: string[]): void {
	// Basic validation to catch common issues before parsing
	for (const stopNode of stopNodes) {
		// Convert dot notation to tag hierarchy
		const tags = stopNode.split(".")
		const lastTag = tags[tags.length - 1]

		// Check if the tag appears to be opened but not closed
		const openTagPattern = new RegExp(`<${lastTag}[^>]*>`, "g")
		const closeTagPattern = new RegExp(`</${lastTag}>`, "g")

		const openMatches = xmlString.match(openTagPattern) || []
		const closeMatches = xmlString.match(closeTagPattern) || []

		// If we have more open tags than close tags, it might be malformed
		if (openMatches.length > closeMatches.length) {
			// Check if the XML appears to be truncated
			const lastCloseTagIndex = xmlString.lastIndexOf(`</${lastTag}>`)
			const lastOpenTagIndex = xmlString.lastIndexOf(`<${lastTag}`)

			if (lastOpenTagIndex > lastCloseTagIndex) {
				console.warn(
					`Warning: XML may be truncated or malformed. ` +
						`Tag <${lastTag}> appears to be opened but not closed properly.`,
				)
			}
		}
	}
}

/**
 * Parses an XML string for diffing purposes, ensuring no HTML entities are decoded.
 * This is a specialized version of parseXml to be used exclusively by diffing tools
 * to prevent mismatches caused by entity processing.
 *
 * Use this instead of parseXml when:
 * - Comparing parsed content against original file content
 * - Performing diff operations where exact character matching is required
 * - Processing XML that will be used in search/replace operations
 *
 * @param xmlString The XML string to parse
 * @param stopNodes Optional array of node names to stop parsing at
 * @returns Parsed JavaScript object representation of the XML
 * @throws Error if the XML is invalid or parsing fails
 */
export function parseXmlForDiff(xmlString: string, stopNodes?: string[]): unknown {
	// Delegate to parseXml with processEntities disabled
	return parseXml(xmlString, stopNodes, { processEntities: false })
}
