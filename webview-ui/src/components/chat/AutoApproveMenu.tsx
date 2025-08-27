import { memo, useCallback, useMemo, useState } from "react"
import { Trans } from "react-i18next"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Stamp, ListChecks, LayoutList } from "lucide-react"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { AutoApproveSetting, autoApproveSettingsConfig } from "../settings/AutoApproveToggle"
import { AutoApproveToggleDropdown } from "./AutoApproveToggleDropdown"
import { StandardTooltip, Popover, PopoverContent, PopoverTrigger } from "@src/components/ui"
import { useAutoApprovalState } from "@src/hooks/useAutoApprovalState"
import { useAutoApprovalToggles } from "@src/hooks/useAutoApprovalToggles"
import { cn } from "@src/lib/utils"
import { useRooPortal } from "@src/components/ui/hooks/useRooPortal"

interface AutoApproveMenuProps {
	style?: React.CSSProperties
}

const AutoApproveMenu = ({ style }: AutoApproveMenuProps) => {
	const [isExpanded, setIsExpanded] = useState(false)
	const portalContainer = useRooPortal("roo-portal")

	const {
		alwaysApproveResubmit,
		setAlwaysAllowReadOnly,
		setAlwaysAllowWrite,
		setAlwaysAllowExecute,
		setAlwaysAllowBrowser,
		setAlwaysAllowMcp,
		setAlwaysAllowModeSwitch,
		setAlwaysAllowSubtasks,
		setAlwaysApproveResubmit,
		setAlwaysAllowFollowupQuestions,
		setAlwaysAllowUpdateTodoList,
	} = useExtensionState()

	const { t } = useAppTranslation()

	const baseToggles = useAutoApprovalToggles()

	// AutoApproveMenu needs alwaysApproveResubmit in addition to the base toggles
	const toggles = useMemo(
		() => ({
			...baseToggles,
			alwaysApproveResubmit: alwaysApproveResubmit,
		}),
		[baseToggles, alwaysApproveResubmit],
	)

	const { hasEnabledOptions, effectiveAutoApprovalEnabled } = useAutoApprovalState(toggles, true)

	const onAutoApproveToggle = useCallback(
		(key: AutoApproveSetting, value: boolean) => {
			vscode.postMessage({ type: key, bool: value })

			// Update the specific toggle state
			switch (key) {
				case "alwaysAllowReadOnly":
					setAlwaysAllowReadOnly(value)
					break
				case "alwaysAllowWrite":
					setAlwaysAllowWrite(value)
					break
				case "alwaysAllowExecute":
					setAlwaysAllowExecute(value)
					break
				case "alwaysAllowBrowser":
					setAlwaysAllowBrowser(value)
					break
				case "alwaysAllowMcp":
					setAlwaysAllowMcp(value)
					break
				case "alwaysAllowModeSwitch":
					setAlwaysAllowModeSwitch(value)
					break
				case "alwaysAllowSubtasks":
					setAlwaysAllowSubtasks(value)
					break
				case "alwaysApproveResubmit":
					setAlwaysApproveResubmit(value)
					break
				case "alwaysAllowFollowupQuestions":
					setAlwaysAllowFollowupQuestions(value)
					break
				case "alwaysAllowUpdateTodoList":
					setAlwaysAllowUpdateTodoList(value)
					break
			}
		},
		[
			toggles,
			setAlwaysAllowReadOnly,
			setAlwaysAllowWrite,
			setAlwaysAllowExecute,
			setAlwaysAllowBrowser,
			setAlwaysAllowMcp,
			setAlwaysAllowModeSwitch,
			setAlwaysAllowSubtasks,
			setAlwaysApproveResubmit,
			setAlwaysAllowFollowupQuestions,
			setAlwaysAllowUpdateTodoList,
		],
	)

	const enabledActionsList = Object.entries(toggles)
		.filter(([_key, value]) => !!value)
		.map(([key]) => t(autoApproveSettingsConfig[key as AutoApproveSetting].labelKey))
		.join(", ")

	// Update displayed text logic
	const displayText = useMemo(() => {
		if (!effectiveAutoApprovalEnabled || !hasEnabledOptions) {
			return t("chat:autoApprove.none")
		}
		return enabledActionsList || t("chat:autoApprove.none")
	}, [effectiveAutoApprovalEnabled, hasEnabledOptions, enabledActionsList, t])

	const handleOpenSettings = useCallback(
		() =>
			window.postMessage({ type: "action", action: "settingsButtonClicked", values: { section: "autoApprove" } }),
		[],
	)

	// Handler for Select All
	const handleSelectAll = useCallback(() => {
		const allSettings: AutoApproveSetting[] = Object.keys(toggles) as AutoApproveSetting[]
		allSettings.forEach((key) => {
			if (!toggles[key]) {
				onAutoApproveToggle(key, true)
			}
		})
	}, [toggles, onAutoApproveToggle])

	// Handler for Select None
	const handleSelectNone = useCallback(() => {
		const allSettings: AutoApproveSetting[] = Object.keys(toggles) as AutoApproveSetting[]
		allSettings.forEach((key) => {
			if (toggles[key]) {
				onAutoApproveToggle(key, false)
			}
		})
	}, [toggles, onAutoApproveToggle])

	const trigger = (
		<PopoverTrigger
			className={cn(
				"inline-flex items-center gap-1.5 relative whitespace-nowrap px-2 py-1 text-xs flex-shrink-1",
				"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
				"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
				"opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
			)}
			style={style}>
			<Stamp className="size-3.5 opacity-80 flex-shrink-0" />
			<span className="font-medium">{t("chat:autoApprove.dropdownTitle")}</span>
			<span className="text-vscode-descriptionForeground truncate max-w-[200px]">{displayText}</span>
		</PopoverTrigger>
	)

	return (
		<Popover open={isExpanded} onOpenChange={setIsExpanded}>
			<StandardTooltip content={t("chat:autoApprove.tooltip")}>{trigger}</StandardTooltip>

			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="p-0 overflow-hidden min-w-[400px] max-w-[500px]">
				<div className="flex flex-col w-full">
					{/* Header */}
					<div className="p-3 border-b border-vscode-dropdown-border">
						<h3 className="m-0 font-bold text-sm text-vscode-button-foreground pb-2">
							{t("chat:autoApprove.title")}
						</h3>
						<div
							style={{
								color: "var(--vscode-descriptionForeground)",
								fontSize: "12px",
							}}>
							<Trans
								i18nKey="chat:autoApprove.description"
								components={{
									settingsLink: <VSCodeLink href="#" onClick={handleOpenSettings} />,
								}}
							/>
						</div>
					</div>

					{/* Two-column layout for toggles */}
					<div className="p-3 max-h-[400px] overflow-y-auto">
						<div className="grid grid-cols-2 gap-x-4">
							<AutoApproveToggleDropdown {...toggles} onToggle={onAutoApproveToggle} />
						</div>
					</div>

					{/* Footer with buttons on left and title on right */}
					<div className="flex items-center justify-between px-3 py-2 border-t border-vscode-dropdown-border">
						<div className="flex items-center gap-2">
							<button
								onClick={handleSelectAll}
								className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded border border-vscode-button-border bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground hover:bg-vscode-button-secondaryHoverBackground transition-colors cursor-pointer">
								<ListChecks className="size-3.5" />
								All
							</button>
							<button
								onClick={handleSelectNone}
								className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded border border-vscode-button-border bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground hover:bg-vscode-button-secondaryHoverBackground transition-colors cursor-pointer">
								<LayoutList className="size-3.5" />
								None
							</button>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}

export default memo(AutoApproveMenu)
