import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Input } from "@/components/ui"

export interface SettingsSearchInputProps {
	value: string
	onChange: (value: string) => void
	onFocus?: () => void
	onBlur?: () => void
}

export function SettingsSearchInput({ value, onChange, onFocus, onBlur }: SettingsSearchInputProps) {
	const { t } = useAppTranslation()

	return (
		<div className="relative flex justify-end ml-2">
			<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-vscode-descriptionForeground pointer-events-none" />
			<Input
				data-testid="settings-search-input"
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onFocus={onFocus}
				onBlur={onBlur}
				placeholder={t("settings:search.placeholder")}
				className={cn(
					"pl-6 w-[0px] focus:pl-8 focus:min-w-[130px] focus:w-full active:w-full",
					value && "pr-8",
				)}
			/>
			{value && (
				<button
					type="button"
					onClick={() => onChange("")}
					className="absolute cursor-pointer right-2.5 top-1/2 -translate-y-1/2 size-4 text-vscode-descriptionForeground hover:text-vscode-foreground focus:outline-none"
					aria-label="Clear search">
					<X className="size-4" />
				</button>
			)}
		</div>
	)
}
