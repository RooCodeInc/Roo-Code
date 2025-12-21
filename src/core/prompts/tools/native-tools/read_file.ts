import type OpenAI from "openai"

const READ_FILE_BASE_DESCRIPTION = `Read one or more files and return their contents with line numbers.`

const READ_FILE_SUPPORTS_NOTE = `Supports text extraction from PDF and DOCX files, but may not handle other binary files properly.`

/**
 * Options for creating the read_file tool definition
 */
export interface CreateReadFileToolOptions {
	/** Whether to include advanced reading parameters (offset, mode, indentation) */
	partialReadsEnabled?: boolean
	/** The configured max lines per read (shown in description for model awareness) */
	maxReadFileLine?: number
}

/**
 * Creates the read_file tool definition with advanced reading modes.
 *
 * @param options - Configuration options for the tool
 * @returns Native tool definition for read_file
 */
export function createReadFileTool(options: CreateReadFileToolOptions = {}): OpenAI.Chat.ChatCompletionTool {
	const { partialReadsEnabled = true, maxReadFileLine } = options

	// Build limit info for descriptions
	const limitInfo = maxReadFileLine && maxReadFileLine > 0 ? `Each read returns up to ${maxReadFileLine} lines. ` : ""

	const baseDescription =
		READ_FILE_BASE_DESCRIPTION +
		" Structure: { files: [{ path: 'relative/path.ts'" +
		(partialReadsEnabled ? ", offset: 1, mode: 'slice' }" : "}") +
		"] }. " +
		"The 'path' is required and relative to workspace. " +
		limitInfo

	const modeDescription = partialReadsEnabled
		? "Two modes available: 'slice' (default) for simple line reading with offset, " +
			"'indentation' for smart code block extraction that expands from an anchor line based on indentation levels. " +
			"Use 'offset' to paginate through large files. "
		: ""

	const examples = partialReadsEnabled
		? "Example simple read: { files: [{ path: 'src/app.ts', offset: 1 }] }. " +
			"Example reading from line 500: { files: [{ path: 'src/app.ts', offset: 500 }] }. " +
			"Example indentation mode: { files: [{ path: 'src/app.ts', offset: 50, mode: 'indentation', indentation: { maxLevels: 2 } }] }. " +
			"Example multiple files: { files: [{ path: 'file1.ts', offset: 1 }, { path: 'file2.ts' }] }"
		: "Example single file: { files: [{ path: 'src/app.ts' }] }. " +
			"Example multiple files: { files: [{ path: 'file1.ts' }, { path: 'file2.ts' }] }"

	const description = baseDescription + modeDescription + READ_FILE_SUPPORTS_NOTE + " " + examples

	// Build the file properties object conditionally
	const fileProperties: Record<string, unknown> = {
		path: {
			type: "string",
			description: "Path to the file to read, relative to the workspace",
		},
	}

	// Only include advanced reading parameters if partial reads are enabled
	if (partialReadsEnabled) {
		const offsetDesc =
			maxReadFileLine && maxReadFileLine > 0
				? `1-indexed line number to start reading from. Use this to paginate through large files (each read returns up to ${maxReadFileLine} lines). Defaults to 1.`
				: "1-indexed line number to start reading from. Use this to paginate through large files. Defaults to 1."

		fileProperties.offset = {
			type: ["integer", "null"],
			description: offsetDesc,
			default: 1,
			minimum: 1,
		}

		fileProperties.mode = {
			type: ["string", "null"],
			enum: ["slice", "indentation", null],
			description:
				"Reading mode: 'slice' for simple line reading (default), 'indentation' for smart code block extraction.",
			default: "slice",
		}

		fileProperties.indentation = {
			type: ["object", "null"],
			description: "Configuration for indentation mode. Only used when mode is 'indentation'.",
			properties: {
				anchorLine: {
					type: ["integer", "null"],
					description: "The line to anchor the block expansion from. Defaults to offset.",
					minimum: 1,
				},
				maxLevels: {
					type: ["integer", "null"],
					description:
						"Maximum indentation depth to collect. 0 = unlimited (expand to file-level). Defaults to 0.",
					default: 0,
					minimum: 0,
				},
				includeSiblings: {
					type: ["boolean", "null"],
					description: "Whether to include sibling blocks at the same indentation level. Defaults to false.",
					default: false,
				},
				includeHeader: {
					type: ["boolean", "null"],
					description: "Whether to include comment headers above the anchor block. Defaults to true.",
					default: true,
				},
			},
			additionalProperties: false,
		}
	}

	// When using strict mode, ALL properties must be in the required array
	// Optional properties are handled by having type: ["...", "null"]
	const fileRequiredProperties = partialReadsEnabled ? ["path", "offset", "mode", "indentation"] : ["path"]

	return {
		type: "function",
		function: {
			name: "read_file",
			description,
			strict: true,
			parameters: {
				type: "object",
				properties: {
					files: {
						type: "array",
						description: "List of files to read; request related files together when allowed",
						items: {
							type: "object",
							properties: fileProperties,
							required: fileRequiredProperties,
							additionalProperties: false,
						},
						minItems: 1,
					},
				},
				required: ["files"],
				additionalProperties: false,
			},
		},
	} satisfies OpenAI.Chat.ChatCompletionTool
}

export const read_file = createReadFileTool({ partialReadsEnabled: false })
