import React, { useState, useEffect } from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { GitBranch, GitCommit, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@src/components/ui/popover"
import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"

interface GitCommitButtonProps {
	className?: string
}

export const GitCommitButton: React.FC<GitCommitButtonProps> = ({ className }) => {
	const { t } = useAppTranslation()
	const [isOpen, setIsOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
	const [message, setMessage] = useState("")

	// Listen for git commit results from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const data = event.data
			if (data.type === "gitCommitResult") {
				setIsLoading(false)
				if (data.success) {
					setStatus("success")
					setMessage(data.text || t("chat:gitCommit.success"))
				} else {
					setStatus("error")
					setMessage(data.text || t("common:errors.git_commit_failed"))
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [t])

	const handleGitCommitPush = () => {
		setIsLoading(true)
		setStatus("idle")
		setMessage(t("chat:gitCommit.prompt"))

		// Send message to extension to handle git operations
		vscode.postMessage({
			type: "gitCommitPush",
		})
	}

	const openTerminalGit = () => {
		setIsOpen(false)
		vscode.postMessage({
			type: "openTerminal",
			text: "git status",
		})
	}

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<button
					className={cn(
						"inline-flex items-center justify-center",
						"bg-transparent border-none p-1.5",
						"rounded-md min-w-[28px] min-h-[28px]",
						"text-vscode-foreground opacity-85",
						"transition-all duration-150",
						"hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
						"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
						"active:bg-[rgba(255,255,255,0.1)]",
						"cursor-pointer",
						className,
					)}
					aria-label={t("chat:gitCommit.tooltip")}
					title={t("chat:gitCommit.tooltip")}>
					{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-80 bg-vscode-editor-background border border-vscode-editorGroup-border shadow-lg p-3"
				onEscapeKeyDown={() => setIsOpen(false)}
				onPointerDownOutside={() => setIsOpen(false)}>
				{/* Header */}
				<div className="flex items-center gap-2 pb-2 border-b border-vscode-editorGroup-border mb-2">
					<GitBranch className="w-4 h-4 text-vscode-foreground shrink-0" />
					<span className="font-medium text-vscode-foreground text-sm flex-grow text-left">
						{t("chat:gitCommit.title")}
					</span>
				</div>

				{/* Content */}
				<div className="space-y-3">
					<p className="text-xs text-vscode-descriptionForeground">{t("chat:gitCommit.description")}</p>

					{/* Quick Actions */}
					<div className="grid grid-cols-2 gap-2">
						<button
							onClick={handleGitCommitPush}
							disabled={isLoading}
							className={cn(
								"flex items-center justify-center gap-2 px-3 py-2 rounded",
								"bg-vscode-button-background text-vscode-button-foreground",
								"hover:bg-vscode-button-hoverBackground",
								"disabled:opacity-50 disabled:cursor-not-allowed",
								"text-xs",
							)}>
							{isLoading ? (
								<Loader2 className="w-3 h-3 animate-spin" />
							) : (
								<GitCommit className="w-3 h-3" />
							)}
							{t("chat:gitCommit.commitPush")}
						</button>

						<button
							onClick={openTerminalGit}
							className={cn(
								"flex items-center justify-center gap-2 px-3 py-2 rounded",
								"bg-vscode-editorWidget-background text-vscode-foreground",
								"hover:bg-vscode-list-hoverBackground",
								"text-xs",
							)}>
							<GitBranch className="w-3 h-3" />
							{t("chat:gitCommit.terminal")}
						</button>
					</div>

					{/* Status Message */}
					{status !== "idle" && (
						<div
							className={cn(
								"px-3 py-2 rounded text-xs",
								status === "success"
									? "bg-green-900/30 text-green-400 border border-green-800"
									: "bg-red-900/30 text-red-400 border border-red-800",
							)}>
							{message}
						</div>
					)}

					{/* Current Branch Info */}
					<div className="text-xs text-vscode-descriptionForeground">
						<span className="font-medium">{t("chat:gitCommit.currentBranch")}:</span>{" "}
						<span className="text-vscode-foreground">main</span>
					</div>

					{/* Quick Commands */}
					<div className="pt-2 border-t border-vscode-editorGroup-border">
						<span className="text-xs font-medium text-vscode-descriptionForeground">
							{t("chat:gitCommit.quickCommands")}
						</span>
						<div className="mt-1 space-y-1">
							<button
								onClick={() => {
									setIsOpen(false)
									vscode.postMessage({ type: "openTerminal", text: "git add -A" })
								}}
								className="w-full text-left px-2 py-1 rounded text-xs text-vscode-foreground hover:bg-vscode-list-hoverBackground">
								<code className="text-vscode-symbolIcon-textForeground">git add -A</code>
							</button>
							<button
								onClick={() => {
									setIsOpen(false)
									vscode.postMessage({ type: "openTerminal", text: "git status" })
								}}
								className="w-full text-left px-2 py-1 rounded text-xs text-vscode-foreground hover:bg-vscode-list-hoverBackground">
								<code className="text-vscode-symbolIcon-textForeground">git status</code>
							</button>
							<button
								onClick={() => {
									setIsOpen(false)
									vscode.postMessage({ type: "openTerminal", text: "git log --oneline -5" })
								}}
								className="w-full text-left px-2 py-1 rounded text-xs text-vscode-foreground hover:bg-vscode-list-hoverBackground">
								<code className="text-vscode-symbolIcon-textForeground">git log</code>
							</button>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}

export default GitCommitButton
