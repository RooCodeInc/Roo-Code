import { memo, useCallback, useMemo, useState } from "react"
import { Trans } from "react-i18next"
import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { AutoApproveToggle, AutoApproveSetting, autoApproveSettingsConfig } from "../settings/AutoApproveToggle"
import { StandardTooltip } from "@src/components/ui"
import { useAutoApprovalState } from "@src/hooks/useAutoApprovalState"
import { useAutoApprovalToggles } from "@src/hooks/useAutoApprovalToggles"
import DismissibleUpsell from "@src/components/common/DismissibleUpsell"
import { useCloudUpsell } from "@src/hooks/useCloudUpsell"
import { CloudUpsellDialog } from "@src/components/cloud/CloudUpsellDialog"

interface AutoApproveMenuProps {
	style?: React.CSSProperties
}

const AutoApproveMenu = ({ style }: AutoApproveMenuProps) => {
	const [isExpanded, setIsExpanded] = useState(false)

	const {
		autoApprovalEnabled,
		setAutoApprovalEnabled,
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

	const { isOpen, openUpsell, closeUpsell, handleConnect } = useCloudUpsell({
		autoOpenOnAuth: false,
	})

	const baseToggles = useAutoApprovalToggles()
	const enabledCount = useMemo(() => Object.values(baseToggles).filter(Boolean).length, [baseToggles])

	// AutoApproveMenu needs alwaysApproveResubmit in addition to the base toggles
	const toggles = useMemo(
		() => ({
			...baseToggles,
			alwaysApproveResubmit: alwaysApproveResubmit,
		}),
		[baseToggles, alwaysApproveResubmit],
	)

	const { hasEnabledOptions, effectiveAutoApprovalEnabled } = useAutoApprovalState(toggles, autoApprovalEnabled)

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

			// Check if we need to update the master auto-approval state
			// Create a new toggles state with the updated value
			const updatedToggles = {
				...toggles,
				[key]: value,
			}

			const willHaveEnabledOptions = Object.values(updatedToggles).some((v) => !!v)

			// If enabling the first option, enable master auto-approval
			if (value && !hasEnabledOptions && willHaveEnabledOptions) {
				setAutoApprovalEnabled(true)
				vscode.postMessage({ type: "autoApprovalEnabled", bool: true })
			}
			// If disabling the last option, disable master auto-approval
			else if (!value && hasEnabledOptions && !willHaveEnabledOptions) {
				setAutoApprovalEnabled(false)
				vscode.postMessage({ type: "autoApprovalEnabled", bool: false })
			}
		},
		[
			toggles,
			hasEnabledOptions,
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
			setAutoApprovalEnabled,
		],
	)

	const toggleExpanded = useCallback(() => {
		setIsExpanded((prev) => !prev)
	}, [])

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

	return (
		<div
			style={{
				margin: "0 12px 0 12px",
				padding: "0px",
				userSelect: "none",
				borderTop: isExpanded
					? `1px solid color-mix(in srgb, var(--vscode-titleBar-inactiveForeground) 20%, transparent)`
					: "none",
				overflowY: "hidden",
				background: "var(--vscode-editorWidget-background, #18181a)",
				borderRadius: "16px",
				boxShadow: isExpanded
					? "0 4px 24px 0 rgba(0,0,0,0.10), 0 1.5px 0 0 rgba(255,255,255,0.04) inset"
					: "none",
				...style,
			}}
			className="transition-shadow duration-200">
			{/* Expanded content */}
			{isExpanded && (
				<div className="flex flex-col gap-3 py-5 px-4 border-b border-[rgba(255,255,255,0.08)]">
					<div className="flex items-center justify-between mb-2">
						<span className="text-lg font-semibold text-[var(--vscode-foreground)] tracking-tight">
							{t("chat:autoApprove.title")}
						</span>
						<StandardTooltip
							content={!hasEnabledOptions ? t("chat:autoApprove.selectOptionsFirst") : undefined}>
							<VSCodeCheckbox
								checked={effectiveAutoApprovalEnabled}
								disabled={!hasEnabledOptions}
								aria-label={
									hasEnabledOptions
										? t("chat:autoApprove.toggleAriaLabel")
										: t("chat:autoApprove.disabledAriaLabel")
								}
								onChange={() => {
									if (hasEnabledOptions) {
										const newValue = !(autoApprovalEnabled ?? false)
										setAutoApprovalEnabled(newValue)
										vscode.postMessage({ type: "autoApprovalEnabled", bool: newValue })
									}
								}}
								style={{
									transform: "scale(1.15)",
									marginRight: "2px",
								}}
							/>
						</StandardTooltip>
					</div>
					<div className="mb-2">
						<span className="text-xs text-[var(--vscode-descriptionForeground)] font-medium">
							{displayText}
						</span>
					</div>
					<AutoApproveToggle {...toggles} onToggle={onAutoApproveToggle} />
					{enabledCount > 7 && (
						<div className="mt-2">
							<DismissibleUpsell
								upsellId="autoApprovePowerUserA"
								onClick={() => openUpsell()}
								dismissOnClick={false}
								variant="banner">
								<Trans
									i18nKey="cloud:upsell.autoApprovePowerUser"
									components={{
										learnMoreLink: <VSCodeLink href="#" />,
									}}
								/>
							</DismissibleUpsell>
						</div>
					)}
				</div>
			)}

			{/* Collapsed/summary bar */}
			<div
				className={`flex items-center gap-2 px-3 py-2 cursor-pointer select-none transition-colors duration-150 ${
					isExpanded ? "bg-[rgba(255,255,255,0.06)]" : "hover:bg-[rgba(255,255,255,0.04)]"
				}`}
				style={{
					borderRadius: isExpanded ? "0 0 16px 16px" : "16px",
					minHeight: "44px",
				}}
				onClick={toggleExpanded}>
				<div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
					<StandardTooltip
						content={!hasEnabledOptions ? t("chat:autoApprove.selectOptionsFirst") : undefined}>
						<VSCodeCheckbox
							checked={effectiveAutoApprovalEnabled}
							disabled={!hasEnabledOptions}
							aria-label={
								hasEnabledOptions
									? t("chat:autoApprove.toggleAriaLabel")
									: t("chat:autoApprove.disabledAriaLabel")
							}
							onChange={() => {
								if (hasEnabledOptions) {
									const newValue = !(autoApprovalEnabled ?? false)
									setAutoApprovalEnabled(newValue)
									vscode.postMessage({ type: "autoApprovalEnabled", bool: newValue })
								}
							}}
							style={{
								transform: "scale(1.08)",
								marginRight: "2px",
							}}
						/>
					</StandardTooltip>
				</div>
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<span
						className="font-medium text-[var(--vscode-foreground)] truncate"
						style={{
							fontSize: "15px",
							letterSpacing: "-0.01em",
						}}>
						{t("chat:autoApprove.title")}
					</span>
					<span
						className={`codicon codicon-chevron-right flex-shrink-0 transition-transform duration-200 ease-in-out ${
							isExpanded ? "-rotate-90 ml-[2px]" : "rotate-0 -ml-[2px]"
						}`}
						style={{
							fontSize: "18px",
							color: "var(--vscode-descriptionForeground)",
						}}
					/>
					{!isExpanded && (
						<span
							className="ml-2 text-xs text-[var(--vscode-descriptionForeground)] truncate"
							style={{
								maxWidth: "180px",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}>
							{displayText}
						</span>
					)}
				</div>
			</div>
			<CloudUpsellDialog open={isOpen} onOpenChange={closeUpsell} onConnect={handleConnect} />
		</div>
	)
}

export default memo(AutoApproveMenu)
