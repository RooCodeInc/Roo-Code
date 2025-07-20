import { Task } from "../../core/task/Task"

/**
 * Interface for editing providers (DiffViewProvider, FileWriter, etc.)
 * This allows tools to work with different editing strategies seamlessly
 */
export interface IEditingProvider {
	// Properties to store the results of saveChanges
	newProblemsMessage?: string
	userEdits?: string
	editType?: "create" | "modify"
	isEditing: boolean
	originalContent: string | undefined

	/**
	 * Prepares for editing the given relative path file
	 * @param relPath The relative file path to open/prepare for editing
	 */
	open(relPath: string): Promise<void>

	/**
	 * Updates the content being edited
	 * @param content The content to apply
	 * @param isFinal Whether this is the final update
	 */
	update(content: string, isFinal: boolean): Promise<void>

	/**
	 * Finalizes the changes and returns diagnostics information
	 * @param diagnosticsEnabled Whether to enable diagnostics (default: true)
	 * @param writeDelayMs Delay in milliseconds before writing changes (default: 1000)
	 */
	saveChanges(
		diagnosticsEnabled: boolean,
		writeDelayMs: number,
	): Promise<{
		newProblemsMessage: string | undefined
		userEdits: string | undefined
		finalContent: string | undefined
	}>

	/**
	 * Formats a standardized XML response for file write operations
	 * @param task The current task context for sending user feedback
	 * @param cwd Current working directory for path resolution
	 * @param isNewFile Whether this is a new file or an existing file being modified
	 * @returns Formatted XML response message
	 */
	pushToolWriteResult(task: Task, cwd: string, isNewFile: boolean): Promise<string>

	/**
	 * Reverts changes (cancels the editing operation)
	 */
	revertChanges(): Promise<void>

	/**
	 * Resets the provider state
	 */
	reset(): Promise<void>

	/**
	 * Scrolls to first diff (diff providers only, no-op for file providers)
	 */
	scrollToFirstDiff(): void
}
