import * as fs from "fs"
import * as path from "path"

import { TerminalOutputPreviewSize, TERMINAL_PREVIEW_BYTES, PersistedCommandOutput } from "@roo-code/types"

import { processCarriageReturns, processBackspaces } from "../misc/extract-text"

/**
 * Configuration options for creating an OutputInterceptor instance.
 */
export interface OutputInterceptorOptions {
	/** Unique identifier for this command execution (typically a timestamp) */
	executionId: string
	/** ID of the task that initiated this command */
	taskId: string
	/** The command string being executed */
	command: string
	/** Directory path where command output artifacts will be stored */
	storageDir: string
	/** Size category for the preview buffer (small/medium/large) */
	previewSize: TerminalOutputPreviewSize
	/** Whether to compress progress bar output using carriage return processing */
	compressProgressBar: boolean
}

/**
 * OutputInterceptor buffers terminal command output and spills to disk when threshold exceeded.
 *
 * This implements a "persisted output" pattern where large command outputs are saved to disk
 * files, with only a preview shown to the LLM. The LLM can then use the `read_command_output`
 * tool to retrieve full contents or search through the output.
 *
 * The interceptor operates in two modes:
 * 1. **Buffer mode**: Output is accumulated in memory until it exceeds the preview threshold
 * 2. **Spill mode**: Once threshold is exceeded, output is streamed directly to disk
 *
 * This approach prevents large command outputs (like build logs, test results, or verbose
 * operations) from overwhelming the context window while still allowing the LLM to access
 * the full output when needed.
 *
 * @example
 * ```typescript
 * const interceptor = new OutputInterceptor({
 *   executionId: Date.now().toString(),
 *   taskId: 'task-123',
 *   command: 'npm test',
 *   storageDir: '/path/to/task/command-output',
 *   previewSize: 'medium',
 *   compressProgressBar: true
 * });
 *
 * // Write output chunks as they arrive
 * interceptor.write('Running tests...\n');
 * interceptor.write('Test 1 passed\n');
 *
 * // Finalize and get the result
 * const result = interceptor.finalize();
 * // result.preview contains truncated output for display
 * // result.artifactPath contains path to full output if truncated
 * ```
 */
export class OutputInterceptor {
	private buffer: string = ""
	private writeStream: fs.WriteStream | null = null
	private artifactPath: string
	private totalBytes: number = 0
	private spilledToDisk: boolean = false
	private readonly previewBytes: number
	private readonly compressProgressBar: boolean

	/**
	 * Creates a new OutputInterceptor instance.
	 *
	 * @param options - Configuration options for the interceptor
	 */
	constructor(private readonly options: OutputInterceptorOptions) {
		this.previewBytes = TERMINAL_PREVIEW_BYTES[options.previewSize]
		this.compressProgressBar = options.compressProgressBar
		this.artifactPath = path.join(options.storageDir, `cmd-${options.executionId}.txt`)
	}

	/**
	 * Write a chunk of output to the interceptor.
	 *
	 * If the accumulated output exceeds the preview threshold, the interceptor
	 * automatically spills to disk and switches to streaming mode. Subsequent
	 * chunks are written directly to the disk file.
	 *
	 * @param chunk - The output string to write
	 *
	 * @example
	 * ```typescript
	 * interceptor.write('Building project...\n');
	 * interceptor.write('Compiling 42 files\n');
	 * ```
	 */
	write(chunk: string): void {
		const chunkBytes = Buffer.byteLength(chunk, "utf8")
		this.totalBytes += chunkBytes

		if (!this.spilledToDisk) {
			this.buffer += chunk

			if (Buffer.byteLength(this.buffer, "utf8") > this.previewBytes) {
				this.spillToDisk()
			}
		} else {
			// Already spilling - write directly to disk
			this.writeStream?.write(chunk)
		}
	}

	/**
	 * Spill buffered content to disk and switch to streaming mode.
	 *
	 * This is called automatically when the buffer exceeds the preview threshold.
	 * Creates the storage directory if it doesn't exist, writes the current buffer
	 * to the artifact file, and prepares for streaming subsequent output.
	 *
	 * @private
	 */
	private spillToDisk(): void {
		// Ensure directory exists
		const dir = path.dirname(this.artifactPath)
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true })
		}

		this.writeStream = fs.createWriteStream(this.artifactPath)
		this.writeStream.write(this.buffer)
		this.spilledToDisk = true

		// Keep only preview portion in memory
		this.buffer = this.buffer.slice(0, this.previewBytes)
	}

	/**
	 * Finalize the interceptor and return the persisted output result.
	 *
	 * Closes any open file streams and returns a summary object containing:
	 * - A preview of the output (truncated to preview size)
	 * - The total byte count of all output
	 * - The path to the full output file (if truncated)
	 * - A flag indicating whether the output was truncated
	 *
	 * If `compressProgressBar` was enabled, the preview will have carriage returns
	 * and backspaces processed to show only final line states.
	 *
	 * @returns The persisted command output summary
	 *
	 * @example
	 * ```typescript
	 * const result = interceptor.finalize();
	 * console.log(`Preview: ${result.preview}`);
	 * console.log(`Total bytes: ${result.totalBytes}`);
	 * if (result.truncated) {
	 *   console.log(`Full output at: ${result.artifactPath}`);
	 * }
	 * ```
	 */
	finalize(): PersistedCommandOutput {
		// Close write stream if open
		if (this.writeStream) {
			this.writeStream.end()
		}

		// Prepare preview
		let preview = this.buffer.slice(0, this.previewBytes)

		// Apply compression to preview only (for readability)
		if (this.compressProgressBar) {
			preview = processCarriageReturns(preview)
			preview = processBackspaces(preview)
		}

		return {
			preview,
			totalBytes: this.totalBytes,
			artifactPath: this.spilledToDisk ? this.artifactPath : null,
			truncated: this.spilledToDisk,
		}
	}

	/**
	 * Get the current buffer content for UI display.
	 *
	 * Returns the in-memory buffer which contains either all output (if not spilled)
	 * or just the preview portion (if spilled to disk).
	 *
	 * @returns The current buffer content as a string
	 */
	getBufferForUI(): string {
		return this.buffer
	}

	/**
	 * Get the artifact file path for this command execution.
	 *
	 * Returns the path where the full output would be/is stored on disk.
	 * The file may not exist if output hasn't exceeded the preview threshold.
	 *
	 * @returns The absolute path to the artifact file
	 */
	getArtifactPath(): string {
		return this.artifactPath
	}

	/**
	 * Check if the output has been spilled to disk.
	 *
	 * @returns `true` if output exceeded threshold and was written to disk
	 */
	hasSpilledToDisk(): boolean {
		return this.spilledToDisk
	}

	/**
	 * Remove all command output artifact files from a directory.
	 *
	 * Deletes all files matching the pattern `cmd-*.txt` in the specified directory.
	 * This is typically called when a task is cleaned up or reset.
	 *
	 * @param storageDir - The directory containing artifact files to clean
	 *
	 * @example
	 * ```typescript
	 * await OutputInterceptor.cleanup('/path/to/task/command-output');
	 * ```
	 */
	static async cleanup(storageDir: string): Promise<void> {
		try {
			const files = await fs.promises.readdir(storageDir)
			for (const file of files) {
				if (file.startsWith("cmd-")) {
					await fs.promises.unlink(path.join(storageDir, file)).catch(() => {})
				}
			}
		} catch {
			// Directory doesn't exist, nothing to clean
		}
	}

	/**
	 * Remove artifact files that are NOT in the provided set of execution IDs.
	 *
	 * This is used for selective cleanup, preserving artifacts that are still
	 * referenced in the conversation history while removing orphaned files.
	 *
	 * @param storageDir - The directory containing artifact files
	 * @param executionIds - Set of execution IDs to preserve (files NOT in this set are deleted)
	 *
	 * @example
	 * ```typescript
	 * // Keep only artifacts for executions 123 and 456
	 * const keepIds = new Set(['123', '456']);
	 * await OutputInterceptor.cleanupByIds('/path/to/command-output', keepIds);
	 * ```
	 */
	static async cleanupByIds(storageDir: string, executionIds: Set<string>): Promise<void> {
		try {
			const files = await fs.promises.readdir(storageDir)
			for (const file of files) {
				const match = file.match(/^cmd-(\d+)\.txt$/)
				if (match && !executionIds.has(match[1])) {
					await fs.promises.unlink(path.join(storageDir, file)).catch(() => {})
				}
			}
		} catch {
			// Directory doesn't exist, nothing to clean
		}
	}
}
