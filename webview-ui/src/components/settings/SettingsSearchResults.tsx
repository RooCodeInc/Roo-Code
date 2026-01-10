import { useMemo } from "react"
import type { LucideIcon } from "lucide-react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import type { SearchResult } from "@/hooks/useSettingsSearch"
import type { SectionName } from "@/utils/parseSettingsI18nKeys"

export interface SettingsSearchResultsProps {
	results: SearchResult[]
	query: string
	onSelectResult: (result: SearchResult) => void
	sections: { id: SectionName; icon: LucideIcon }[]
}

interface HighlightMatchProps {
	text: string
	query: string
}

/**
 * Highlights matching parts of text by wrapping them in <mark> tags.
 */
function HighlightMatch({ text, query }: HighlightMatchProps) {
	if (!query.trim()) {
		return <>{text}</>
	}

	// Split text by query (case-insensitive) while keeping the matched parts
	const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
	const parts = text.split(regex)

	return (
		<>
			{parts.map((part, index) =>
				regex.test(part) ? (
					<mark key={index} className="bg-vscode-editor-findMatchHighlightBackground text-inherit">
						{part}
					</mark>
				) : (
					<span key={index}>{part}</span>
				),
			)}
		</>
	)
}

export function SettingsSearchResults({ results, query, onSelectResult, sections }: SettingsSearchResultsProps) {
	const { t } = useAppTranslation()

	// Group results by tab
	const groupedResults = useMemo(() => {
		return results.reduce(
			(acc, result) => {
				const tab = result.tab
				if (!acc[tab]) {
					acc[tab] = []
				}
				acc[tab].push(result)
				return acc
			},
			{} as Record<SectionName, SearchResult[]>,
		)
	}, [results])

	// Create a map of section id to icon for quick lookup
	const sectionIconMap = useMemo(() => {
		return new Map(sections.map((section) => [section.id, section.icon]))
	}, [sections])

	// If no results, show a message
	if (results.length === 0) {
		return (
			<div className="max-h-80 overflow-y-auto p-4 text-vscode-descriptionForeground text-sm">
				{t("settings:search.noResults", { query })}
			</div>
		)
	}

	return (
		<div className="max-h-80 overflow-y-auto">
			{Object.entries(groupedResults).map(([tab, tabResults]) => {
				const Icon = sectionIconMap.get(tab as SectionName)

				return (
					<div key={tab}>
						{/* Tab header */}
						<div className="flex items-center gap-2 px-3 py-1.5 text-xs text-vscode-descriptionForeground bg-vscode-sideBar-background sticky top-0">
							{Icon && <Icon className="h-3.5 w-3.5" />}
							<span>{t(`settings:sections.${tab}`)}</span>
						</div>

						{/* Result items */}
						{tabResults.map((result) => (
							<button
								key={result.id}
								type="button"
								onClick={() => onSelectResult(result)}
								className="w-full text-left px-3 py-2 hover:bg-vscode-list-hoverBackground focus:bg-vscode-list-hoverBackground focus:outline-none">
								<div className="text-sm text-vscode-foreground">
									<HighlightMatch text={result.translatedLabel} query={query} />
								</div>
								{result.translatedDescription && (
									<div className="text-xs text-vscode-descriptionForeground truncate mt-0.5">
										<HighlightMatch text={result.translatedDescription} query={query} />
									</div>
								)}
							</button>
						))}
					</div>
				)
			})}
		</div>
	)
}
