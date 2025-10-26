import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Fzf } from "fzf"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { ModelInfo, ProviderName, ProviderSettings } from "@roo-code/types"
import type { RouterModels } from "@roo/api"

import { cn } from "@/lib/utils"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { filterModels } from "@/components/settings/utils/organizationFilters"
import { MODELS_BY_PROVIDER as STATIC_MODELS_BY_PROVIDER } from "@/components/settings/constants"
import { vscode } from "@/utils/vscode"

import { IconButton } from "./IconButton"

interface ModelSelectorProps {
	apiConfiguration?: ProviderSettings
	title: string
	triggerClassName?: string
	open?: boolean
	onOpenChange?: (open: boolean) => void
	onModelSelect: (modelId: string, modelInfo?: ModelInfo) => void
}

type ExtendedModelRecord = Record<string, ModelInfo>

interface ModelOption {
	id: string
	label: string
	info?: ModelInfo
}

const resolveDisplayName = (modelId: string, modelInfo?: ModelInfo): string => {
	if (modelInfo && typeof (modelInfo as Record<string, unknown>).displayName === "string") {
		return (modelInfo as Record<string, unknown>).displayName as string
	}
	return modelId
}

const resolveModelsForProvider = (
	provider: ProviderName | undefined,
	routerModels?: RouterModels,
): ExtendedModelRecord | undefined => {
	if (!provider) return undefined

	switch (provider) {
		case "openrouter":
			return routerModels?.openrouter
		case "requesty":
			return routerModels?.requesty
		case "glama":
			return routerModels?.glama
		case "unbound":
			return routerModels?.unbound
		case "litellm":
			return routerModels?.litellm
		case "deepinfra":
			return routerModels?.deepinfra
		case "io-intelligence":
			return routerModels?.["io-intelligence"]
		case "roo":
			return routerModels?.roo
		case "vercel-ai-gateway":
			return routerModels?.["vercel-ai-gateway"]
		case "ollama":
			return routerModels?.ollama
		case "lmstudio":
			return routerModels?.lmstudio
		case "huggingface":
			return routerModels?.huggingface
		default:
			return STATIC_MODELS_BY_PROVIDER[provider]
	}
}

const ModelSelectorInner = ({
	apiConfiguration,
	title,
	triggerClassName = "",
	open,
	onOpenChange,
	onModelSelect,
}: ModelSelectorProps) => {
	const { t } = useAppTranslation()
	const { organizationAllowList, routerModels } = useExtensionState()
	const [internalOpen, setInternalOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const searchInputRef = useRef<HTMLInputElement>(null)
	const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
	const portalContainer = useRooPortal("roo-portal")
	const isControlled = typeof open === "boolean"
	const currentOpen = isControlled ? open : internalOpen
	const { id: selectedModelId, info: selectedModelInfo, provider } = useSelectedModel(apiConfiguration)
	const [activeIndex, setActiveIndex] = useState(0)
	const initializedActiveRef = useRef(false)
	const previousSelectedModelRef = useRef<string | undefined>(selectedModelId)
	const suppressHoverRef = useRef(false)
	const hoverResetTimerRef = useRef<number | undefined>(undefined)

	useEffect(() => {
		return () => {
			if (hoverResetTimerRef.current !== undefined) {
				window.clearTimeout(hoverResetTimerRef.current)
			}
		}
	}, [])

	const setOpen = useCallback(
		(isOpen: boolean) => {
			if (!isControlled) {
				setInternalOpen(isOpen)
			}
			onOpenChange?.(isOpen)
		},
		[isControlled, onOpenChange],
	)

	const availableModels = useMemo(() => {
		const modelsRecord = resolveModelsForProvider(provider, routerModels)
		if (!modelsRecord) return {}

		const filtered = filterModels(modelsRecord, provider, organizationAllowList) ?? {}
		if (selectedModelId && modelsRecord[selectedModelId] && !filtered[selectedModelId]) {
			return { ...filtered, [selectedModelId]: modelsRecord[selectedModelId] }
		}
		return filtered
	}, [organizationAllowList, provider, routerModels, selectedModelId])

	const searchableModels = useMemo(() => {
		return Object.entries(availableModels).map(([id, info]) => {
			const label = resolveDisplayName(id, info)
			return {
				id,
				info,
				label,
				searchStr: [id, label].filter(Boolean).join(" "),
			}
		})
	}, [availableModels])

	const fzfInstance = useMemo(
		() => new Fzf(searchableModels, { selector: (item) => item.searchStr }),
		[searchableModels],
	)

	const modelOptions = useMemo<ModelOption[]>(() => {
		if (!searchValue) {
			return searchableModels.map(({ id, info, label }) => ({ id, label, info }))
		}

		return fzfInstance.find(searchValue).map((result) => ({
			id: result.item.id,
			label: result.item.label,
			info: result.item.info,
		}))
	}, [fzfInstance, searchableModels, searchValue])

	useEffect(() => {
		if (!currentOpen) {
			setSearchValue("")
		}
	}, [currentOpen])

	useEffect(() => {
		if (currentOpen) {
			searchInputRef.current?.focus()
		}
	}, [currentOpen])

	useEffect(() => {
		if (!currentOpen) {
			initializedActiveRef.current = false
			previousSelectedModelRef.current = selectedModelId
			return
		}

		const defaultIndex = modelOptions.findIndex((option) => option.id === selectedModelId)
		const shouldReset =
			!initializedActiveRef.current || previousSelectedModelRef.current !== selectedModelId || defaultIndex === -1
		if (shouldReset) {
			setActiveIndex(defaultIndex >= 0 ? defaultIndex : 0)
			initializedActiveRef.current = true
			previousSelectedModelRef.current = selectedModelId
		}
	}, [currentOpen, modelOptions, selectedModelId])

	useEffect(() => {
		if (!currentOpen) return
		const activeOption = modelOptions[activeIndex]
		if (activeOption) {
			itemRefs.current[activeOption.id]?.scrollIntoView({ block: "nearest" })
		}
	}, [activeIndex, currentOpen, modelOptions])

	useEffect(() => {
		if (!modelOptions.length && activeIndex !== 0) {
			setActiveIndex(0)
			return
		}

		if (activeIndex >= modelOptions.length && modelOptions.length > 0) {
			setActiveIndex(modelOptions.length - 1)
		}
	}, [activeIndex, modelOptions.length])

	useEffect(() => {
		if (!currentOpen) return
		const activeOption = modelOptions[activeIndex]
		if (searchValue && activeOption && !activeOption.label.toLowerCase().includes(searchValue.toLowerCase())) {
			setActiveIndex(0)
		}
	}, [searchValue, currentOpen, activeIndex, modelOptions])

	const registerItemRef = useCallback(
		(id: string) => (el: HTMLDivElement | null) => {
			itemRefs.current[id] = el
		},
		[],
	)

	const handleSelect = useCallback(
		(modelId: string) => {
			const modelInfo = availableModels[modelId]
			onModelSelect(modelId, modelInfo)
			setOpen(false)
		},
		[availableModels, onModelSelect, setOpen],
	)

	const handleOpenSettings = useCallback(() => {
		vscode.postMessage({ type: "switchTab", tab: "settings", values: { section: "providers" } })
		setOpen(false)
	}, [setOpen])

	const selectedModelLabel = resolveDisplayName(selectedModelId ?? "", selectedModelInfo)

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (!currentOpen) return

			if (event.key === "Escape") {
				event.preventDefault()
				setOpen(false)
				return
			}

			if (!modelOptions.length) {
				return
			}

			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault()
				suppressHoverRef.current = true
				if (hoverResetTimerRef.current !== undefined) {
					window.clearTimeout(hoverResetTimerRef.current)
				}
				hoverResetTimerRef.current = window.setTimeout(() => {
					suppressHoverRef.current = false
					hoverResetTimerRef.current = undefined
				}, 120)
				setActiveIndex((prevIndex) => {
					if (event.key === "ArrowDown") {
						return (prevIndex + 1) % modelOptions.length
					}
					return (prevIndex - 1 + modelOptions.length) % modelOptions.length
				})
				return
			}

			if (event.key === "Enter") {
				event.preventDefault()
				const activeOption = modelOptions[activeIndex]
				if (activeOption) {
					handleSelect(activeOption.id)
				}
			}
		},
		[activeIndex, currentOpen, handleSelect, modelOptions, setOpen],
	)

	return (
		<Popover open={currentOpen} onOpenChange={setOpen} data-testid="model-selector-root">
			<StandardTooltip content={title}>
				<PopoverTrigger
					data-testid="model-selector-trigger"
					className={cn(
						"inline-flex items-center relative whitespace-nowrap px-1.5 py-1 text-xs",
						"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
						"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
						"opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
						triggerClassName,
					)}>
					<span className="truncate" data-testid="model-selector-label">
						{selectedModelLabel || t("chat:modelSelector.none")}
					</span>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent
				tabIndex={-1}
				onKeyDown={handleKeyDown}
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="p-0 overflow-hidden min-w-72 max-w-9/10"
				data-testid="model-selector-content">
				<div className="flex flex-col w-full">
					<div className="relative p-2 border-b border-vscode-dropdown-border">
						<input
							ref={searchInputRef}
							value={searchValue}
							onChange={(event) => {
								setSearchValue(event.target.value)
								setActiveIndex(0)
							}}
							placeholder={t("chat:modelSelector.searchPlaceholder")}
							className="w-full h-8 px-2 py-1 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-0"
							data-testid="model-selector-search"
						/>
					</div>

					<Command className="max-h-[300px] overflow-hidden">
						<CommandList
							className="max-h-[300px] overflow-y-auto"
							onPointerMove={() => {
								if (suppressHoverRef.current) {
									suppressHoverRef.current = false
								}
							}}>
							{modelOptions.length === 0 ? (
								<CommandEmpty>
									<div className="py-2 px-3 text-sm text-vscode-foreground/70">
										{t("chat:modelSelector.emptyState")}
									</div>
								</CommandEmpty>
							) : (
								<CommandGroup className="py-1">
									{modelOptions.map((option, index) => {
										const isSelected = option.id === selectedModelId
										const isActive = index === activeIndex
										return (
											<CommandItem
												key={option.id}
												ref={registerItemRef(option.id)}
												onSelect={() => handleSelect(option.id)}
												onMouseEnter={() => {
													if (suppressHoverRef.current) return
													setActiveIndex(index)
												}}
												className={cn(
													"px-3 py-1.5 text-sm cursor-pointer flex items-center gap-2",
													isActive && !isSelected && "bg-vscode-list-hoverBackground",
													isSelected &&
														"bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground",
												)}
												data-testid={`model-option-${option.id}`}>
												<div className="flex-1 min-w-0">
													<div className="font-bold truncate">{option.label}</div>
													{option.info?.description && (
														<div className="text-xs text-vscode-descriptionForeground truncate">
															{option.info.description}
														</div>
													)}
												</div>
												{isSelected && (
													<span className="codicon codicon-check text-xs ml-auto" />
												)}
											</CommandItem>
										)
									})}
								</CommandGroup>
							)}
						</CommandList>
					</Command>

					<div className="flex flex-row items-center justify-between px-2 py-2 border-t border-vscode-dropdown-border">
						<div className="flex flex-row gap-1">
							<IconButton
								iconClass="codicon-settings-gear"
								title={t("chat:modelSelector.settings")}
								onClick={handleOpenSettings}
							/>
						</div>
						<div className="flex items-center gap-1 pr-1">
							<StandardTooltip content={t("chat:modelSelector.currentField")}>
								<span className="codicon codicon-info text-xs text-vscode-descriptionForeground opacity-70 hover:opacity-100 cursor-help" />
							</StandardTooltip>
							<h4 className="m-0 font-medium text-sm text-vscode-descriptionForeground">
								{t("chat:modelSelector.infoTitle")}
							</h4>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}

export const ModelSelector = (props: ModelSelectorProps) => {
	const queryClientRef = useRef<QueryClient>()
	if (!queryClientRef.current) {
		queryClientRef.current = new QueryClient()
	}
	return (
		<QueryClientProvider client={queryClientRef.current}>
			<ModelSelectorInner {...props} />
		</QueryClientProvider>
	)
}
