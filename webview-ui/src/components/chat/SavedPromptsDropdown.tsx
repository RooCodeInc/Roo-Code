import React, { useEffect, useRef, useState } from "react"
import { Bookmark, ChevronDown, Settings } from "lucide-react"

import type { SavedPrompt } from "@roo-code/types"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import {
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
	StandardTooltip,
} from "@/components/ui"
import { vscode } from "@/utils/vscode"

interface SavedPromptsDropdownProps {
	disabled?: boolean
}

export const SavedPromptsDropdown: React.FC<SavedPromptsDropdownProps> = ({ disabled }) => {
	const { t } = useAppTranslation()
	const { savedPrompts, listApiConfigMeta } = useExtensionState()
	const [open, setOpen] = useState(false)

	// Request saved prompts when component mounts
	useEffect(() => {
		vscode.postMessage({ type: "requestSavedPrompts" })
	}, [])

	const handleSelectPrompt = (prompt: SavedPrompt) => {
		vscode.postMessage({
			type: "useSavedPrompt",
			savedPromptId: prompt.id,
		})
		setOpen(false)
	}

	const handleOpenSettings = () => {
		vscode.postMessage({
			type: "action",
			action: "settingsButtonClicked",
		})
		// Note: User will need to navigate to Saved Prompts settings manually
		setOpen(false)
	}

	const promptsList = savedPrompts || []

	if (promptsList.length === 0) {
		return null // Don't show the dropdown if there are no saved prompts
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<StandardTooltip content={t("chat:savedPrompts.tooltip")}>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						disabled={disabled}
						className="size-7 opacity-70 hover:opacity-100">
						<Bookmark className="w-4 h-4" />
					</Button>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent className="w-64 p-0" align="end">
				<div className="py-1">
					<div className="px-3 py-2 text-xs font-medium text-vscode-descriptionForeground border-b border-vscode-panel-border">
						{t("chat:savedPrompts.title")}
					</div>
					<div className="max-h-64 overflow-y-auto">
						{promptsList.map((prompt: SavedPrompt) => {
							const apiConfig = listApiConfigMeta?.find(
								(config) => config.id === prompt.apiConfigId,
							)
							return (
								<button
									key={prompt.id}
									onClick={() => handleSelectPrompt(prompt)}
									className="w-full px-3 py-2 text-left hover:bg-vscode-list-hoverBackground flex flex-col gap-0.5">
									<span className="text-sm font-medium truncate">{prompt.name}</span>
									{prompt.description && (
										<span className="text-xs text-vscode-descriptionForeground truncate">
											{prompt.description}
										</span>
									)}
									{apiConfig && (
										<span className="text-xs text-vscode-textLink-foreground truncate">
											→ {apiConfig.name}
										</span>
									)}
								</button>
							)
						})}
					</div>
					<div className="border-t border-vscode-panel-border pt-1">
						<button
							onClick={handleOpenSettings}
							className="w-full px-3 py-2 text-left hover:bg-vscode-list-hoverBackground flex items-center gap-2 text-sm text-vscode-descriptionForeground">
							<Settings className="w-3.5 h-3.5" />
							{t("chat:savedPrompts.managePrompts")}
						</button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
