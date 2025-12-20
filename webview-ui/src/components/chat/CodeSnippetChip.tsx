import React, { useMemo } from "react"
import { X, FileCode } from "lucide-react"

import type { CodeSnippet } from "@roo-code/types"
import { formatCodeSnippetLabel } from "@roo-code/types"

import { cn } from "@src/lib/utils"
import { StandardTooltip } from "@src/components/ui"
import { useAppTranslation } from "@src/i18n/TranslationContext"

interface CodeSnippetChipProps {
	snippet: CodeSnippet
	onRemove: (id: string) => void
	className?: string
}

/**
 * A compact chip component that displays a collapsed code snippet reference.
 * Shows the file name and line range in a pill format.
 * Users can click the X to remove the snippet.
 */
export const CodeSnippetChip: React.FC<CodeSnippetChipProps> = ({ snippet, onRemove, className }) => {
	const { t } = useAppTranslation()

	const label = useMemo(() => formatCodeSnippetLabel(snippet), [snippet])

	const tooltipContent = useMemo(() => {
		const lineCount = snippet.endLine - snippet.startLine + 1
		return t("chat:codeSnippetTooltip", {
			lineCount,
			defaultValue: `${lineCount} line${lineCount > 1 ? "s" : ""} of code`,
		})
	}, [snippet, t])

	return (
		<StandardTooltip content={tooltipContent}>
			<div
				className={cn(
					"inline-flex items-center gap-1 px-2 py-0.5",
					"bg-vscode-badge-background text-vscode-badge-foreground",
					"rounded-full text-xs font-medium",
					"border border-vscode-contrastBorder",
					"max-w-[200px] truncate",
					className,
				)}>
				<FileCode className="w-3 h-3 flex-shrink-0" />
				<span className="truncate">{label}</span>
				<button
					onClick={(e) => {
						e.preventDefault()
						e.stopPropagation()
						onRemove(snippet.id)
					}}
					className={cn(
						"inline-flex items-center justify-center",
						"w-3.5 h-3.5 ml-0.5 flex-shrink-0",
						"rounded-full",
						"hover:bg-vscode-toolbar-hoverBackground",
						"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
						"cursor-pointer",
					)}
					aria-label={t("chat:removeCodeSnippet", { defaultValue: "Remove code snippet" })}>
					<X className="w-2.5 h-2.5" />
				</button>
			</div>
		</StandardTooltip>
	)
}

interface CodeSnippetChipsProps {
	snippets: CodeSnippet[]
	onRemove: (id: string) => void
	className?: string
}

/**
 * Container component for displaying multiple code snippet chips.
 */
export const CodeSnippetChips: React.FC<CodeSnippetChipsProps> = ({ snippets, onRemove, className }) => {
	if (snippets.length === 0) {
		return null
	}

	return (
		<div className={cn("flex flex-wrap gap-1 px-2 py-1.5", className)}>
			{snippets.map((snippet) => (
				<CodeSnippetChip key={snippet.id} snippet={snippet} onRemove={onRemove} />
			))}
		</div>
	)
}
