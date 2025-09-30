import { useState, useMemo, useCallback } from "react"
import { Fzf } from "fzf"

import { cn } from "@/lib/utils"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { Button } from "@/components/ui"
import { useExtensionState } from "@/context/ExtensionStateContext"

import { IconButton } from "./IconButton"
import { useAppTranslation } from "@/i18n/TranslationContext"

interface ConfigItemProps {
	config: { id: string; name: string; modelId?: string }
	isPinned: boolean
	index: number
	value: string
	onSelect: (configId: string) => void
	togglePinnedApiConfig: (id: string) => void
}

const ConfigItem = ({ config, isPinned, index, value, onSelect, togglePinnedApiConfig }: ConfigItemProps) => {
	const { t } = useAppTranslation()
	const isCurrentConfig = config.id === value

	return (
		<div
			key={config.id}
			data-config-item
			data-config-item-index={index}
			role="option"
			aria-selected={isCurrentConfig}
			aria-label={`${config.name}${config.modelId ? ` - ${config.modelId}` : ""}`}
			onClick={() => onSelect(config.id)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault()
					onSelect(config.id)
				}
			}}
			className={cn(
				"px-3 py-1.5 text-sm flex items-center group relative",
				"cursor-pointer hover:bg-vscode-list-hoverBackground",
				isCurrentConfig &&
					"bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground",
			)}>
			<div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
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
				<StandardTooltip
					content={isPinned ? t("chat:apiConfigSelector.unpin") : t("chat:apiConfigSelector.pin")}>
					<Button
						variant="ghost"
						size="icon"
						tabIndex={-1}
						aria-label={isPinned ? t("chat:apiConfigSelector.unpin") : t("chat:apiConfigSelector.pin")}
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
}

type SortMode = "alphabetical" | "custom"

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
	const { apiConfigsCustomOrder: customOrder = [] } = useExtensionState()
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const [sortMode, setSortMode] = useState<SortMode>("alphabetical")

	const portalContainer = useRooPortal("roo-portal")

	// Sort configs based on sort mode
	const sortedConfigs = useMemo(() => {
		const sorted = [...listApiConfigMeta]

		switch (sortMode) {
			case "alphabetical":
				sorted.sort((a, b) => a.name.localeCompare(b.name))
				break
			case "custom":
				if (customOrder && customOrder.length > 0) {
					// Sort by custom order, with unordered items at the end
					const orderMap = new Map(customOrder.map((item) => [item.id, item.index]))
					sorted.sort((a, b) => {
						const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER
						const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER
						return (aIndex as number) - (bIndex as number)
					})
				}
				break
		}

		return sorted
	}, [listApiConfigMeta, sortMode, customOrder])

	// Filter configs based on search.
	const filteredConfigs = useMemo(() => {
		if (!searchValue) {
			return sortedConfigs
		}

		const fzf = new Fzf(sortedConfigs, { selector: (item) => item.name })
		const matchingItems = fzf.find(searchValue).map((result) => result.item)
		return matchingItems
	}, [sortedConfigs, searchValue])

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

	return (
		<Popover open={open} onOpenChange={setOpen} data-testid="api-config-selector-root">
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
				className="p-0 overflow-hidden w-[300px]">
				<div className="flex flex-col w-full">
					{/* Search input or info blurb */}
					{listApiConfigMeta.length > 6 ? (
						<div className="relative p-2 border-b border-vscode-dropdown-border">
							<input
								aria-label={t("common:ui.search_placeholder")}
								value={searchValue}
								onChange={(e) => setSearchValue(e.target.value)}
								placeholder={t("common:ui.search_placeholder")}
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
					<div
						className="max-h-[300px] overflow-y-auto"
						role="listbox"
						aria-label={t("prompts:apiConfiguration.select")}>
						{filteredConfigs.length === 0 && searchValue ? (
							<div className="py-2 px-3 text-sm text-vscode-foreground/70">
								{t("common:ui.no_results")}
							</div>
						) : (
							<div className="py-1">
								{/* Pinned configs */}
								{pinnedConfigs.map((config, index) => (
									<ConfigItem
										key={config.id}
										config={config}
										isPinned
										index={index}
										value={value}
										onSelect={handleSelect}
										togglePinnedApiConfig={togglePinnedApiConfig}
									/>
								))}

								{/* Separator between pinned and unpinned */}
								{pinnedConfigs.length > 0 && unpinnedConfigs.length > 0 && (
									<div className="mx-1 my-1 h-px bg-vscode-dropdown-foreground/10" />
								)}

								{/* Unpinned configs */}
								{unpinnedConfigs.map((config, index) => (
									<ConfigItem
										key={config.id}
										config={config}
										isPinned={false}
										index={pinnedConfigs.length + index}
										value={value}
										onSelect={handleSelect}
										togglePinnedApiConfig={togglePinnedApiConfig}
									/>
								))}
							</div>
						)}
					</div>

					{/* Bottom bar with controls */}
					<div className="flex flex-col border-t border-vscode-dropdown-border">
						{/* Sort controls */}
						<div className="flex items-center justify-between px-2 py-1.5 border-b border-vscode-dropdown-border">
							<div className="flex items-center gap-2">
								<span className="text-xs text-vscode-descriptionForeground">
									{t("chat:apiConfigSelector.sort")}
								</span>
								<div className="flex items-center gap-1">
									{(["alphabetical", "custom"] as const).map((mode) => (
										<Button
											key={mode}
											variant="ghost"
											size="sm"
											aria-label={`${t("chat:apiConfigSelector.sort")} ${mode === "alphabetical" ? t("chat:apiConfigSelector.alphabetical") : t("chat:apiConfigSelector.custom")}`}
											aria-pressed={sortMode === mode}
											onClick={() => setSortMode(mode)}
											className={cn(
												"h-6 px-2 text-xs",
												sortMode === mode &&
													"bg-vscode-button-background text-vscode-button-foreground",
											)}>
											{mode === "alphabetical"
												? t("chat:apiConfigSelector.alphabetical")
												: t("chat:apiConfigSelector.custom")}
										</Button>
									))}
								</div>
							</div>
						</div>

						{/* Bottom bar with settings and title */}
						<div className="flex flex-row items-center justify-between px-2 py-2">
							<div className="flex flex-row gap-1">
								<IconButton
									iconClass="codicon-settings-gear"
									title={t("chat:apiConfigSelector.editConfigurations")}
									onClick={handleEditClick}
									tooltip={false}
									aria-label="chat:edit"
								/>
							</div>

							{/* Info icon and title on the right with matching spacing */}
							<div className="flex items-center gap-1 pr-1">
								{listApiConfigMeta.length > 6 && (
									<StandardTooltip content={t("prompts:apiConfiguration.select")}>
										<span
											className="codicon codicon-info text-xs text-vscode-descriptionForeground opacity-70 hover:opacity-100 cursor-help"
											aria-label={t("prompts:apiConfiguration.select")}
											role="img"
										/>
									</StandardTooltip>
								)}
								<h4 className="m-0 font-medium text-sm text-vscode-descriptionForeground">
									{t("prompts:apiConfiguration.title")}
								</h4>
							</div>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
