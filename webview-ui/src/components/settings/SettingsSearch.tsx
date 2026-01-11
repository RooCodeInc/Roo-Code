import { useRef, useEffect, useState } from "react"
import { Search, X } from "lucide-react"

import { Input } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { cn } from "@/lib/utils"

import { useSettingsSearch, SearchResult, SearchableSettingData } from "./useSettingsSearch"
import { SectionName } from "./SettingsView"

interface SettingsSearchProps {
	index: SearchableSettingData[]
	onNavigate: (section: SectionName, settingId: string) => void
}

export function SettingsSearch({ index, onNavigate }: SettingsSearchProps) {
	const { t } = useAppTranslation()
	const inputRef = useRef<HTMLInputElement>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const { searchQuery, setSearchQuery, results, isOpen, setIsOpen, clearSearch } = useSettingsSearch({ index })
	const [selectedIndex, setSelectedIndex] = useState(0)

	// Handle keyboard navigation
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "ArrowDown") {
			e.preventDefault()
			setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
		} else if (e.key === "ArrowUp") {
			e.preventDefault()
			setSelectedIndex((i) => Math.max(i - 1, 0))
		} else if (e.key === "Enter" && results[selectedIndex]) {
			e.preventDefault()
			handleSelect(results[selectedIndex])
		} else if (e.key === "Escape") {
			clearSearch()
			inputRef.current?.blur()
		}
	}

	const handleSelect = (result: SearchResult) => {
		onNavigate(result.section, result.settingId)
		clearSearch()
	}

	// Reset selected index when results change
	useEffect(() => {
		setSelectedIndex(0)
	}, [results])

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target as Node) &&
				!inputRef.current?.contains(e.target as Node)
			) {
				setIsOpen(false)
			}
		}
		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [setIsOpen])

	return (
		<div className="relative">
			<div className="relative">
				<Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-vscode-descriptionForeground" />
				<Input
					ref={inputRef}
					type="text"
					placeholder={t("settings:search.placeholder")}
					value={searchQuery}
					onChange={(e) => {
						setSearchQuery(e.target.value)
						setIsOpen(true)
					}}
					onFocus={() => searchQuery && setIsOpen(true)}
					onKeyDown={handleKeyDown}
					className="pl-8 pr-8 h-8 w-48"
				/>
				{searchQuery && (
					<button
						onClick={clearSearch}
						className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5"
						type="button">
						<X className="w-4 h-4 text-vscode-descriptionForeground hover:text-vscode-foreground" />
					</button>
				)}
			</div>

			{isOpen && results.length > 0 && (
				<div
					ref={dropdownRef}
					className="absolute top-full left-0 right-0 mt-1 z-50 bg-vscode-dropdown-background border border-vscode-dropdown-border rounded-md shadow-lg max-h-64 overflow-y-auto">
					{results.map((result, index) => (
						<button
							key={`${result.section}-${result.settingId}`}
							onClick={() => handleSelect(result)}
							className={cn(
								"w-full px-3 py-2 text-left hover:bg-vscode-list-hoverBackground",
								index === selectedIndex && "bg-vscode-list-activeSelectionBackground",
							)}
							type="button">
							<div className="text-sm font-medium text-vscode-foreground truncate">{result.label}</div>
							<div className="text-xs text-vscode-descriptionForeground">→ {result.sectionLabel}</div>
						</button>
					))}
				</div>
			)}

			{isOpen && searchQuery && results.length === 0 && (
				<div
					ref={dropdownRef}
					className="absolute top-full left-0 right-0 mt-1 z-50 bg-vscode-dropdown-background border border-vscode-dropdown-border rounded-md shadow-lg p-3 text-sm text-vscode-descriptionForeground">
					{t("settings:search.noResults")}
				</div>
			)}
		</div>
	)
}
