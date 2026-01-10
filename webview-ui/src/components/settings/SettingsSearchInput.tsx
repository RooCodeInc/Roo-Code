import { type RefObject } from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Input } from "@/components/ui"

export interface SettingsSearchInputProps {
	value: string
	onChange: (value: string) => void
	onFocus?: () => void
	onBlur?: () => void
	onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
	inputRef?: RefObject<HTMLInputElement>
}

export function SettingsSearchInput({
	value,
	onChange,
	onFocus,
	onBlur,
	onKeyDown,
	inputRef,
}: SettingsSearchInputProps) {
	const { t } = useAppTranslation()

	return (
		<div className="relative flex justify-end ml-2">
			<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-vscode-descriptionForeground pointer-events-none" />
			<Input
				ref={inputRef}
				data-testid="settings-search-input"
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onFocus={onFocus}
				onBlur={onBlur}
				onKeyDown={onKeyDown}
				placeholder={t("settings:search.placeholder")}
				className={cn(
					"pl-6 focus:pl-8 w-[0px] border-none focus:border-vscode-input-border focus:min-w-[90px] focus:w-full",
					value && "pl-8 pr-8 min-w-[50px] w-full",
				)}
			/>
			{value && (
				<button
					type="button"
					onClick={() => onChange("")}
					className="absolute cursor-pointer right-2 top-1/2 -translate-y-1/2 size-4 text-vscode-descriptionForeground hover:text-vscode-foreground focus:outline-none"
					aria-label="Clear search">
					<X className="size-3" />
				</button>
			)}
		</div>
	)
}
