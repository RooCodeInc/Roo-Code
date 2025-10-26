import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { Fzf } from "fzf"

import { cn } from "@/lib/utils"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"
import { Button } from "@/components/ui"

import { IconButton } from "./IconButton"

interface ApiConfigSelectorProps {
	value: string
	displayName: string
	disabled?: boolean
	title: string
	onChange: (value: string) => void
	triggerClassName?: string
	listApiConfigMeta: Array<{ id: string; name: string; modelId?: string }>
	pinnedApiConfigs?: Record<string, boolean>
	togglePinnedApiConfig: (id: string) => void
	open?: boolean
	onOpenChange?: (open: boolean) => void
}

export const ApiConfigSelector = ({
	value,
	displayName,
	disabled = false,
	title,
	onChange,
	triggerClassName = "",
	listApiConfigMeta,
	pinnedApiConfigs,
	togglePinnedApiConfig,
	open,
	onOpenChange,
}: ApiConfigSelectorProps) => {
	const { t } = useAppTranslation()
	const [internalOpen, setInternalOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const [activeIndex, setActiveIndex] = useState(0)
	const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
	const contentRef = useRef<HTMLDivElement>(null)
	const initializedActiveRef = useRef(false)
	const previousValueRef = useRef(value)
	const portalContainer = useRooPortal("roo-portal")
	const isControlled = typeof open === "boolean"
	const currentOpen = isControlled ? open : internalOpen

	const setOpen = useCallback(
		(isOpen: boolean) => {
			if (!isControlled) {
				setInternalOpen(isOpen)
			}
			onOpenChange?.(isOpen)
		},
		[isControlled, onOpenChange],
	)

	useEffect(() => {
		if (!currentOpen) {
			setSearchValue("")
		}
	}, [currentOpen])

	// Create searchable items for fuzzy search.
	const searchableItems = useMemo(
		() =>
			listApiConfigMeta.map((config) => ({
				original: config,
				searchStr: config.name,
			})),
		[listApiConfigMeta],
	)

	// Create Fzf instance.
	const fzfInstance = useMemo(
		() => new Fzf(searchableItems, { selector: (item) => item.searchStr }),
		[searchableItems],
	)

	// Filter configs based on search.
	const filteredConfigs = useMemo(() => {
		if (!searchValue) {
			return listApiConfigMeta
		}

		const matchingItems = fzfInstance.find(searchValue).map((result) => result.item.original)
		return matchingItems
	}, [listApiConfigMeta, searchValue, fzfInstance])

	// Separate pinned and unpinned configs.
	const { pinnedConfigs, unpinnedConfigs } = useMemo(() => {
		const pinned = filteredConfigs.filter((config) => pinnedApiConfigs?.[config.id])
		const unpinned = filteredConfigs.filter((config) => !pinnedApiConfigs?.[config.id])
		return { pinnedConfigs: pinned, unpinnedConfigs: unpinned }
	}, [filteredConfigs, pinnedApiConfigs])

	const visibleConfigs = useMemo(() => [...pinnedConfigs, ...unpinnedConfigs], [pinnedConfigs, unpinnedConfigs])

	const handleSelect = useCallback(
		(configId: string) => {
			onChange(configId)
			setOpen(false)
			setSearchValue("")
		},
		[onChange, setOpen],
	)

	useEffect(() => {
		if (!currentOpen) {
			initializedActiveRef.current = false
			previousValueRef.current = value
			return
		}

		const defaultIndex = visibleConfigs.findIndex((config) => config.id === value)
		const shouldReset = !initializedActiveRef.current || previousValueRef.current !== value || defaultIndex === -1
		if (shouldReset) {
			setActiveIndex(defaultIndex >= 0 ? defaultIndex : 0)
			initializedActiveRef.current = true
			previousValueRef.current = value
		}
	}, [currentOpen, value, visibleConfigs])

	useEffect(() => {
		if (!currentOpen) return

		const activeConfig = visibleConfigs[activeIndex]
		if (activeConfig) {
			itemRefs.current[activeConfig.id]?.scrollIntoView({ block: "nearest" })
		}
	}, [activeIndex, currentOpen, visibleConfigs])

	useEffect(() => {
		if (!visibleConfigs.length && activeIndex !== 0) {
			setActiveIndex(0)
			return
		}

		if (activeIndex >= visibleConfigs.length && visibleConfigs.length > 0) {
			setActiveIndex(visibleConfigs.length - 1)
		}
	}, [activeIndex, visibleConfigs.length])

	const handleEditClick = useCallback(() => {
		vscode.postMessage({ type: "switchTab", tab: "settings" })
		setOpen(false)
	}, [setOpen])

	const registerItemRef = useCallback(
		(id: string) => (el: HTMLDivElement | null) => {
			itemRefs.current[id] = el
		},
		[],
	)

	const renderConfigItem = useCallback(
		(config: { id: string; name: string; modelId?: string }, isPinned: boolean, itemIndex: number) => {
			const isCurrentConfig = config.id === value
			const isActive = itemIndex === activeIndex

			return (
				<div
					key={config.id}
					onClick={() => handleSelect(config.id)}
					onMouseEnter={() => setActiveIndex(itemIndex)}
					className={cn(
						"px-3 py-1.5 text-sm cursor-pointer flex items-center group",
						isActive && !isCurrentConfig && "bg-vscode-list-hoverBackground",
						isCurrentConfig &&
							"bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground",
					)}
					data-active={isActive ? "true" : undefined}>
					<div
						ref={registerItemRef(config.id)}
						className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden"
						role="option"
						aria-selected={isCurrentConfig}>
						<span className="flex-shrink-0">{config.name}</span>
						{config.modelId && (
							<>
								<span
									className="text-vscode-descriptionForeground opacity-70 min-w-0 overflow-hidden"
									style={{ direction: "rtl", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
									{config.modelId}
								</span>
							</>
						)}
					</div>
					<div className="flex items-center gap-1">
						{isCurrentConfig && (
							<div className="size-5 p-1 flex items-center justify-center">
								<span className="codicon codicon-check text-xs" />
							</div>
						)}
						<StandardTooltip content={isPinned ? t("chat:unpin") : t("chat:pin")}>
							<Button
								variant="ghost"
								size="icon"
								tabIndex={-1}
								onClick={(e) => {
									e.stopPropagation()
									togglePinnedApiConfig(config.id)
									vscode.postMessage({ type: "toggleApiConfigPin", text: config.id })
								}}
								className={cn("size-5 flex items-center justify-center", {
									"opacity-0 group-hover:opacity-100": !isPinned && !isCurrentConfig,
									"bg-accent opacity-100": isPinned,
								})}>
								<span className="codicon codicon-pin text-xs opacity-50" />
							</Button>
						</StandardTooltip>
					</div>
				</div>
			)
		},
		[value, handleSelect, t, togglePinnedApiConfig, activeIndex, registerItemRef],
	)

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (!currentOpen) return

			if (event.key === "Escape") {
				event.preventDefault()
				setOpen(false)
				return
			}

			if (!visibleConfigs.length) {
				return
			}

			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault()
				setActiveIndex((prevIndex) => {
					if (event.key === "ArrowDown") {
						return (prevIndex + 1) % visibleConfigs.length
					}
					return (prevIndex - 1 + visibleConfigs.length) % visibleConfigs.length
				})
				return
			}

			if (event.key === "Enter") {
				event.preventDefault()
				const activeConfig = visibleConfigs[activeIndex]
				if (activeConfig) {
					handleSelect(activeConfig.id)
				}
			}
		},
		[activeIndex, currentOpen, handleSelect, setOpen, visibleConfigs],
	)

	useEffect(() => {
		if (!currentOpen) return
		if (listApiConfigMeta.length <= 6) {
			contentRef.current?.focus()
		}
	}, [currentOpen, listApiConfigMeta.length])

	const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setSearchValue(event.target.value)
		setActiveIndex(0)
	}, [])

	let displayIndex = 0

	return (
		<Popover open={currentOpen} onOpenChange={setOpen} data-testid="api-config-selector-root">
			<StandardTooltip content={title}>
				<PopoverTrigger
					disabled={disabled}
					data-testid="dropdown-trigger"
					className={cn(
						"min-w-0 inline-flex items-center relative whitespace-nowrap px-1.5 py-1 text-xs",
						"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
						"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
						disabled
							? "opacity-50 cursor-not-allowed"
							: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
						triggerClassName,
					)}>
					<span className="truncate">{displayName}</span>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				tabIndex={-1}
				className="p-0 overflow-hidden w-[300px]">
				<div ref={contentRef} className="flex flex-col w-full" tabIndex={-1} onKeyDown={handleKeyDown}>
					{/* Search input or info blurb */}
					{listApiConfigMeta.length > 6 ? (
						<div className="relative p-2 border-b border-vscode-dropdown-border">
							<input
								aria-label={t("chat:apiConfigSelector.searchPlaceholder")}
								value={searchValue}
								onChange={handleSearchChange}
								placeholder={t("chat:apiConfigSelector.searchPlaceholder")}
								className="w-full h-8 px-2 py-1 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-0"
								autoFocus
							/>
							{searchValue.length > 0 && (
								<div className="absolute right-4 top-0 bottom-0 flex items-center justify-center">
									<span
										className="codicon codicon-close text-vscode-input-foreground opacity-50 hover:opacity-100 text-xs cursor-pointer"
										onClick={() => setSearchValue("")}
									/>
								</div>
							)}
						</div>
					) : (
						<div className="p-3 border-b border-vscode-dropdown-border">
							<p className="text-xs text-vscode-descriptionForeground m-0">
								{t("prompts:apiConfiguration.select")}
							</p>
						</div>
					)}

					{/* Config list */}
					<div className="max-h-[300px] overflow-y-auto">
						{filteredConfigs.length === 0 && searchValue ? (
							<div className="py-2 px-3 text-sm text-vscode-foreground/70">
								{t("common:ui.no_results")}
							</div>
						) : (
							<div className="py-1">
								{/* Pinned configs */}
								{pinnedConfigs.map((config) => renderConfigItem(config, true, displayIndex++))}

								{/* Separator between pinned and unpinned */}
								{pinnedConfigs.length > 0 && unpinnedConfigs.length > 0 && (
									<div className="mx-1 my-1 h-px bg-vscode-dropdown-foreground/10" />
								)}

								{/* Unpinned configs */}
								{unpinnedConfigs.map((config) => renderConfigItem(config, false, displayIndex++))}
							</div>
						)}
					</div>

					{/* Bottom bar with buttons on left and title on right */}
					<div className="flex flex-row items-center justify-between px-2 py-2 border-t border-vscode-dropdown-border">
						<div className="flex flex-row gap-1">
							<IconButton
								iconClass="codicon-settings-gear"
								title={t("chat:apiConfigSelector.settings")}
								onClick={handleEditClick}
							/>
						</div>

						{/* Info icon and title on the right with matching spacing */}
						<div className="flex items-center gap-1 pr-1">
							{listApiConfigMeta.length > 6 && (
								<StandardTooltip content={t("prompts:apiConfiguration.select")}>
									<span className="codicon codicon-info text-xs text-vscode-descriptionForeground opacity-70 hover:opacity-100 cursor-help" />
								</StandardTooltip>
							)}
							<h4 className="m-0 font-medium text-sm text-vscode-descriptionForeground">
								{t("prompts:apiConfiguration.title")}
							</h4>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
