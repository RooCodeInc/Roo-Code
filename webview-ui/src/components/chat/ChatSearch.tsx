import React, { useCallback, useEffect, useRef } from "react"
import { VSCodeButton, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"
import { StandardTooltip } from "@src/components/ui"
import { useChatSearch } from "./hooks/useChatSearch"
import type { ClineMessage } from "@roo-code/types"
import { useDebounceEffect } from "@/utils/useDebounceEffect"

export interface ChatSearchProps {
	messages: ClineMessage[]
	onSearchChange?: (hasResults: boolean, searchQuery?: string) => void
	onNavigateToResult: (messageIndex: number) => void
	onClose: () => void
	showSearch?: boolean
}

export const ChatSearch: React.FC<ChatSearchProps> = ({
	showSearch,
	messages,
	onSearchChange = () => {},
	onNavigateToResult,
	onClose,
}) => {
	const { t } = useTranslation()
	const {
		searchQuery,
		setSearchQuery,
		searchResults,
		currentResultIndex,
		totalResults,
		hasResults,
		goToNextResult,
		goToPreviousResult,
		resetSearch,
	} = useChatSearch(messages)
	const searchInputRef = useRef<HTMLInputElement | null>(null)

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (event.key === "Enter") {
				event.preventDefault()
				if (event.shiftKey) {
					goToPreviousResult()
				} else {
					goToNextResult()
				}
			} else if (event.key === "Escape") {
				event.preventDefault()
				onClose()
			}
		},
		[goToNextResult, goToPreviousResult, onClose],
	)

	const handleClose = useCallback(() => {
		resetSearch()
		onClose()
	}, [resetSearch, onClose])

	useEffect(() => {
		onSearchChange(hasResults, searchQuery)
	}, [hasResults, searchQuery, onSearchChange])

	// Automatically navigate to current result when search results change
	useDebounceEffect(
		() => {
			if (hasResults && searchResults[currentResultIndex]) {
				const messageIndex = searchResults[currentResultIndex].index
				onNavigateToResult(messageIndex)
			}
		},
		500,
		[currentResultIndex, hasResults, searchResults, onNavigateToResult],
	)

	// Focus the manual URL input when it becomes visible
	useEffect(() => {
		if (showSearch && searchInputRef.current) {
			// Small delay to ensure the DOM is ready
			setTimeout(() => {
				searchInputRef.current?.focus()
			}, 100)
		}
	}, [showSearch])

	return (
		<div className="flex items-center gap-4 px-3 py-2 border-b border-vscode-panel-border">
			<div className="flex items-center gap-2 flex-1 min-w-0">
				<VSCodeTextField
					ref={searchInputRef as any}
					value={searchQuery}
					placeholder={t("settings:experimental.CHAT_SEARCH.placeholder")}
					onInput={(e: any) => setSearchQuery((e.target.value || "").trim())}
					onKeyDown={handleKeyDown}
					className="flex-1 min-w-0"
					style={{ marginBottom: 0 }}
				/>
			</div>

			<div className="flex items-center gap-3">
				{
					<div className="flex items-center gap-2 px-3 py-1 ">
						<span className="text-xs text-vscode-badge-foreground font-medium">
							{t("settings:experimental.CHAT_SEARCH.resultsCount", {
								current: totalResults ? currentResultIndex + 1 : 0,
								total: totalResults,
							})}
						</span>
						<div className="flex items-center gap-1">
							<StandardTooltip content={t("settings:experimental.CHAT_SEARCH.previous")}>
								<VSCodeButton
									appearance="icon"
									onClick={goToPreviousResult}
									disabled={!hasResults || currentResultIndex === 0}
									className="h-5 px-1">
									<span className="codicon codicon-arrow-up" />
								</VSCodeButton>
							</StandardTooltip>

							<StandardTooltip content={t("settings:experimental.CHAT_SEARCH.next")}>
								<VSCodeButton
									appearance="icon"
									onClick={goToNextResult}
									disabled={!hasResults || currentResultIndex === totalResults - 1}
									className="h-5 px-1">
									<span className="codicon codicon-arrow-down" />
								</VSCodeButton>
							</StandardTooltip>
						</div>
					</div>
				}

				<StandardTooltip content={t("settings:experimental.CHAT_SEARCH.close")}>
					<VSCodeButton appearance="icon" onClick={handleClose} className="h-6 px-1">
						<span className="codicon codicon-close" />
					</VSCodeButton>
				</StandardTooltip>
			</div>
		</div>
	)
}

export default ChatSearch
