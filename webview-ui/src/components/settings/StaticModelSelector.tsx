import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@src/lib/utils"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useEscapeKey } from "@src/hooks/useEscapeKey"
import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@src/components/ui"

interface StaticModelSelectorProps {
	value: string
	onValueChange: (value: string) => void
	options: Array<{ value: string; label: string }>
	placeholder?: string
	className?: string
	"data-testid"?: string
}

export const StaticModelSelector = ({
	value,
	onValueChange,
	options,
	placeholder,
	className,
	"data-testid": dataTestId,
}: StaticModelSelectorProps) => {
	const { t } = useAppTranslation()
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const searchInputRef = useRef<HTMLInputElement>(null)
	const selectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	// Check if the search value exactly matches any existing option
	const searchMatchesExactOption = useMemo(() => {
		if (!searchValue) return false
		return options.some((option) => option.value === searchValue)
	}, [options, searchValue])

	const onSelect = useCallback(
		(selectedValue: string) => {
			if (!selectedValue) return

			setOpen(false)
			onValueChange(selectedValue)

			// Clear any existing timeout
			if (selectTimeoutRef.current) {
				clearTimeout(selectTimeoutRef.current)
			}

			// Delay to ensure the popover is closed before clearing search
			selectTimeoutRef.current = setTimeout(() => setSearchValue(""), 100)
		},
		[onValueChange],
	)

	const onOpenChange = useCallback((isOpen: boolean) => {
		setOpen(isOpen)

		// Clear search when closing
		if (!isOpen) {
			if (closeTimeoutRef.current) {
				clearTimeout(closeTimeoutRef.current)
			}
			closeTimeoutRef.current = setTimeout(() => setSearchValue(""), 100)
		}
	}, [])

	const onClearSearch = useCallback(() => {
		setSearchValue("")
		searchInputRef.current?.focus()
	}, [])

	// Cleanup timeouts on unmount
	useEffect(() => {
		return () => {
			if (selectTimeoutRef.current) {
				clearTimeout(selectTimeoutRef.current)
			}
			if (closeTimeoutRef.current) {
				clearTimeout(closeTimeoutRef.current)
			}
		}
	}, [])

	// Use ESC key handler
	useEscapeKey(open, () => setOpen(false))

	// Check if current value is a custom model (not in the options list)
	const isCustomModel = value && !options.some((opt) => opt.value === value)

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant="combobox"
					role="combobox"
					aria-expanded={open}
					className={cn("w-full justify-between", className)}
					data-testid={dataTestId || "static-model-selector-button"}>
					<div className="truncate">{value || placeholder || t("settings:common.select")}</div>
					<ChevronsUpDown className="opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
				<Command>
					<div className="relative">
						<CommandInput
							ref={searchInputRef}
							value={searchValue}
							onValueChange={setSearchValue}
							placeholder={t("settings:modelPicker.searchPlaceholder")}
							className="h-9 mr-4"
							data-testid="static-model-input"
						/>
						{searchValue.length > 0 && (
							<div className="absolute right-2 top-0 bottom-0 flex items-center justify-center">
								<X
									className="text-vscode-input-foreground opacity-50 hover:opacity-100 size-4 p-0.5 cursor-pointer"
									onClick={onClearSearch}
								/>
							</div>
						)}
					</div>
					<CommandList>
						<CommandEmpty>
							{searchValue && (
								<div className="py-2 px-1 text-sm">{t("settings:modelPicker.noMatchFound")}</div>
							)}
						</CommandEmpty>
						<CommandGroup>
							{/* Show current custom model at the top if it exists */}
							{isCustomModel && (
								<CommandItem
									value={value}
									onSelect={onSelect}
									data-testid={`model-option-custom-${value}`}>
									<span className="truncate" title={value}>
										{value} <span className="text-vscode-descriptionForeground">(custom)</span>
									</span>
									<Check className={cn("size-4 p-0.5 ml-auto", "opacity-100")} />
								</CommandItem>
							)}
							{/* Show all options - Command will filter based on search */}
							{options.map((option) => (
								<CommandItem
									key={option.value}
									value={option.value}
									onSelect={onSelect}
									data-testid={`model-option-${option.value}`}>
									<span className="truncate" title={option.label}>
										{option.label}
									</span>
									<Check
										className={cn(
											"size-4 p-0.5 ml-auto",
											option.value === value ? "opacity-100" : "opacity-0",
										)}
									/>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
					{/* Show option to use custom model if search value doesn't exactly match any option */}
					{searchValue && !searchMatchesExactOption && searchValue !== value && (
						<div className="p-1 border-t border-vscode-input-border">
							<CommandItem data-testid="use-custom-model" value={searchValue} onSelect={onSelect}>
								{t("settings:modelPicker.useCustomModel", { modelId: searchValue })}
							</CommandItem>
						</div>
					)}
				</Command>
			</PopoverContent>
		</Popover>
	)
}
