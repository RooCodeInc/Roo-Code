import { useState, useMemo, useCallback } from "react"
import { Fzf } from "fzf"
import { ChevronUp } from "lucide-react"

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
}: ApiConfigSelectorProps) => {
	const { t } = useAppTranslation()
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const portalContainer = useRooPortal("roo-portal")

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

	const handleSelect = useCallback(
		(configId: string) => {
			onChange(configId)
			setOpen(false)
			setSearchValue("")
		},
		[onChange],
	)

	const handleEditClick = useCallback(() => {
		vscode.postMessage({ type: "switchTab", tab: "settings" })
		setOpen(false)
	}, [])

	const renderConfigItem = useCallback(
		(config: { id: string; name: string; modelId?: string }, isPinned: boolean) => {
			const isCurrentConfig = config.id === value

			return (
				<div
					key={config.id}
					onClick={() => handleSelect(config.id)}
					className={cn(
						"px-3 py-1.5 text-sm cursor-pointer flex items-center group",
						"hover:bg-[rgba(255,255,255,0.09)] rounded-xl",
						isCurrentConfig && "bg-[rgba(255,255,255,0.05)] text-white",
					)}>
					<div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
						<span className="flex-shrink-0">{config.name}</span>
						{config.modelId && (
							<>
								<span
									className="text-[rgba(255,255,255,0.5)] opacity-70 min-w-0 overflow-hidden"
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
									"bg-[rgba(255,255,255,0.2)] opacity-100": isPinned,
								})}>
								<span className="codicon codicon-pin text-xs opacity-50" />
							</Button>
						</StandardTooltip>
					</div>
				</div>
			)
		},
		[value, handleSelect, t, togglePinnedApiConfig],
	)

	return (
		<Popover open={open} onOpenChange={setOpen} data-testid="api-config-selector-root">
			<StandardTooltip content={title}>
				<PopoverTrigger
					disabled={disabled}
					data-testid="dropdown-trigger"
					className={cn(
						"w-full min-w-0 max-w-full inline-flex items-center gap-1.5 relative whitespace-nowrap px-1.5 py-1 text-xs",
						"bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-full text-vscode-foreground",
						"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
						disabled
							? "opacity-50 cursor-not-allowed"
							: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
						triggerClassName,
					)}>
					<ChevronUp
						className={cn(
							"pointer-events-none opacity-80 flex-shrink-0 size-3 transition-transform duration-200",
							open && "rotate-180",
						)}
					/>
					<span className="truncate">{displayName}</span>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="p-2 overflow-hidden w-[250px] bg-[rgba(0,0,0,0.4)] border border-[rgba(255,255,255,0.08)] shadow-lg">
				<div className="flex flex-col w-full">
					{/* Search input or info blurb */}
					{listApiConfigMeta.length > 6 ? (
						<div className="relative p-2 border-b border-gray-400">
							<input
								aria-label={t("common:ui.search_placeholder")}
								value={searchValue}
								onChange={(e) => setSearchValue(e.target.value)}
								placeholder={t("common:ui.search_placeholder")}
								className="w-full h-8 px-2 py-1 text-xs bg-vscode-input-background text-vscode-input-foreground border border-gray-400 rounded focus:outline-0"
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
						<div className="px-2 py-2 border-b border-gray-400 text-xs text-vscode-descriptionForeground">
							<div className="flex items-center gap-1">
								<span className="codicon codicon-info text-xs" />
								<span>{t("prompts:apiConfiguration.select")}</span>
							</div>
							<h4 className="m-0 mt-1 font-medium text-sm">{t("prompts:apiConfiguration.title")}</h4>
						</div>
					)}

					{/* Bottom bar with buttons on left and title on right */}
					<div className="flex flex-row items-center justify-center ">
						<div className="flex flex-row gap-1">
							<IconButton
								iconClass="codicon-settings-gear"
								title={t("chat:edit")}
								onClick={handleEditClick}
								tooltip={false}
							/>
						</div>

						{/* Info icon and title on the right with matching spacing */}
						<div className="flex items-center gap-1 pr-1">
							{listApiConfigMeta.length <= 6 && (
								<StandardTooltip content={t("prompts:apiConfiguration.select")}>
									<span className="codicon codicon-info text-xs text-gray-400 opacity-70 hover:opacity-100 cursor-help" />
								</StandardTooltip>
							)}
							<h4 className="m-0 font-medium text-sm text-gray-400">
								{t("prompts:apiConfiguration.title")}
							</h4>
						</div>
					</div>
					{/* Config list */}
					<div className="max-h-[300px] overflow-y-auto">
						{filteredConfigs.length === 0 && searchValue ? (
							<div className="py-2 px-3 text-sm uppercase ">{t("common:ui.no_results")}</div>
						) : (
							<div className="py-1">
								{/* Pinned configs */}
								{pinnedConfigs.map((config) => renderConfigItem(config, true))}

								{/* Separator between pinned and unpinned */}
								{pinnedConfigs.length > 0 && unpinnedConfigs.length > 0 && (
									<div className="mx-1 my-1 h-px bg-gray-400 " />
								)}

								{/* Unpinned configs */}
								{unpinnedConfigs.map((config) => renderConfigItem(config, false))}
							</div>
						)}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
