import React from "react"
import { AlertTriangle } from "lucide-react"

import type { HookWithMetadata } from "@roo-code/types"

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui"

interface DeleteHookDialogProps {
	/** Whether the dialog is open */
	open: boolean
	/** Callback when the dialog open state changes */
	onOpenChange: (open: boolean) => void
	/** The hook to delete, or null if no hook is selected */
	hookToDelete: HookWithMetadata | null
	/** Callback when delete is confirmed */
	onConfirm: () => void
}

/**
 * Confirmation dialog for deleting a hook.
 *
 * Shows:
 * - Hook name and ID being deleted
 * - Warning message that the action cannot be undone
 * - Which file (global or project) will be modified
 * - Cancel and Delete buttons (Delete has destructive styling)
 */
export const DeleteHookDialog: React.FC<DeleteHookDialogProps> = ({ open, onOpenChange, hookToDelete, onConfirm }) => {
	if (!hookToDelete) {
		return null
	}

	const sourceLabel = hookToDelete.source === "global" ? "global configuration" : "project configuration"

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2">
						<AlertTriangle className="w-5 h-5 text-vscode-errorForeground" />
						Delete Hook
					</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="space-y-3">
							<p>
								Are you sure you want to delete the hook{" "}
								<strong className="text-vscode-foreground">{hookToDelete.name}</strong>{" "}
								<span className="font-mono text-xs bg-vscode-input-background px-1 py-0.5 rounded">
									{hookToDelete.id}
								</span>
								?
							</p>
							<p className="text-vscode-errorForeground">This action cannot be undone.</p>
							<p className="text-xs">
								The hook will be removed from the{" "}
								<strong className="text-vscode-foreground">{sourceLabel}</strong> file
								{hookToDelete.filePath && (
									<>
										{" "}
										at{" "}
										<code className="bg-vscode-input-background px-1 py-0.5 rounded">
											{hookToDelete.filePath}
										</code>
									</>
								)}
								.
							</p>
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className="bg-vscode-errorForeground hover:bg-vscode-errorForeground/90 text-white">
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
