import React from "react"
import { ChevronUp, Check } from "lucide-react"
import { Mode, getAllModes } from "@roo/modes"
import { cn } from "@/lib/utils"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { IconButton } from "./IconButton"
import { vscode } from "@/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useModeSelectorTracking } from "./hooks/useModeSelectorTracking"

interface ModeSelectorProps {
	value: Mode
	onChange: (value: Mode) => void
	disabled?: boolean
	title?: string
	triggerClassName?: string
	modeShortcutText: string
	customModes?: any[]
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
	value,
	onChange,
	disabled = false,
	title = "",
	triggerClassName = "",
	modeShortcutText,
	customModes,
}) => {
	const [open, setOpen] = React.useState(false)
	const portalContainer = useRooPortal("roo-portal")
	const { experiments } = useExtensionState()
	const { hasOpenedModeSelector, trackModeSelectorOpened } = useModeSelectorTracking()

	// Get all available modes
	const modes = React.useMemo(() => getAllModes(customModes), [customModes])

	// Find the selected mode
	const selectedMode = React.useMemo(() => modes.find((mode) => mode.slug === value), [modes, value])

	return (
		<Popover
			open={open}
			onOpenChange={(isOpen) => {
				if (isOpen) {
					trackModeSelectorOpened()
				}
				setOpen(isOpen)
			}}
			data-testid="mode-selector-root">
			<PopoverTrigger
				disabled={disabled}
				title={title}
				data-testid="mode-selector-trigger"
				className={cn(
					"inline-flex items-center gap-1.5 relative whitespace-nowrap px-1.5 py-1 text-xs",
					"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
					"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
					disabled
						? "opacity-50 cursor-not-allowed"
						: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
					triggerClassName,
					!disabled && !hasOpenedModeSelector
						? "bg-primary opacity-90 hover:bg-primary-hover text-vscode-button-foreground"
						: null,
				)}>
				<ChevronUp className="pointer-events-none opacity-80 flex-shrink-0 size-3" />
				<span className="truncate">{selectedMode?.name || ""}</span>
			</PopoverTrigger>

			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="p-0 overflow-hidden w-[320px]">
				<div className="flex flex-col w-full">
					<div className="p-3 border-b border-vscode-dropdown-border cursor-default">
						<div className="flex flex-row items-center gap-1 p-0 mt-0 mb-1 w-full">
							<h4 className="m-0 pb-2 flex-1">Modes</h4>
							<div className="flex flex-row gap-1 ml-auto mb-1">
								{experiments.marketplace && (
									<IconButton
										iconClass="codicon-extensions"
										title="Mode Marketplace"
										onClick={() => {
											vscode.postMessage({
												type: "switchTab",
												tab: "marketplace",
											})

											setOpen(false)
										}}
									/>
								)}
								<IconButton
									iconClass="codicon-settings-gear"
									title="Mode Settings"
									onClick={() => {
										vscode.postMessage({
											type: "switchTab",
											tab: "modes",
										})
										setOpen(false)
									}}
								/>
							</div>
						</div>
						<p className="my-0 text-sm">
							Specialized personas that tailor Roo&apos;s behavior.
							<br />
							{modeShortcutText}
						</p>
					</div>

					{/* Mode List */}
					<div className="max-h-[400px] overflow-y-auto py-0">
						{modes.map((mode) => (
							<div
								className={cn(
									"p-2 text-sm cursor-pointer flex flex-row gap-4 items-center",
									"hover:bg-vscode-list-hoverBackground",
									mode.slug === value
										? "bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground"
										: "",
								)}
								key={mode.slug}
								onClick={() => {
									onChange(mode.slug as Mode)
									setOpen(false)
								}}
								data-testid="mode-selector-item">
								<div>
									<p className="m-0 mb-0 font-bold">{mode.name}</p>
									{mode.description && (
										<p className="m-0 py-0 pl-4 overflow-hidden h-4 flex-1 text-xs">
											{mode.description}
										</p>
									)}
								</div>
								{mode.slug === value && <Check className="ml-auto size-4 p-0.5 flex-1" />}
							</div>
						))}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}

export default ModeSelector
