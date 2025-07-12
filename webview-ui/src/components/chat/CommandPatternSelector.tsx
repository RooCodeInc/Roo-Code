import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"

interface CommandPattern {
	pattern: string
	description: string
}

interface CommandPatternSelectorProps {
	patterns: CommandPattern[]
	allowedCommands: string[]
	onPatternChange: (pattern: string) => void
}

export const CommandPatternSelector = ({ patterns, allowedCommands, onPatternChange }: CommandPatternSelectorProps) => {
	const { t } = useAppTranslation()
	const [isExpanded, setIsExpanded] = useState(false)

	if (patterns.length === 0) {
		return null
	}

	return (
		<div className="border-t border-vscode-panel-border bg-vscode-sideBar-background/30">
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex items-center gap-2 w-full px-3 py-2 text-xs text-vscode-descriptionForeground hover:text-vscode-foreground hover:bg-vscode-list-hoverBackground transition-all"
				aria-label={isExpanded ? "Collapse allowed commands section" : "Expand allowed commands section"}
				aria-expanded={isExpanded}>
				<ChevronDown
					className={cn("size-3 transition-transform duration-200", {
						"rotate-0": isExpanded,
						"-rotate-90": !isExpanded,
					})}
				/>
				<span className="font-medium">{t("chat:commandExecution.addToAllowedCommands")}</span>
			</button>
			{isExpanded && (
				<div className="px-3 pb-3 space-y-1.5">
					{patterns.map((item, index) => (
						<div key={`${item.pattern}-${index}`} className="ml-5">
							<VSCodeCheckbox
								checked={allowedCommands.includes(item.pattern)}
								onChange={() => onPatternChange(item.pattern)}
								className="text-xs"
								aria-label={`Allow command pattern: ${item.pattern}`}>
								<span className="font-mono text-vscode-foreground">{item.pattern}</span>
							</VSCodeCheckbox>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

CommandPatternSelector.displayName = "CommandPatternSelector"
