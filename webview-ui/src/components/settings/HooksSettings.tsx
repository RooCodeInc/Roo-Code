import React, { useCallback, useEffect, useState } from "react"
import { RefreshCw, FolderOpen, AlertTriangle, Clock, Zap, X } from "lucide-react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import { Button, StandardTooltip } from "@src/components/ui"
import type { HookInfo, HookExecutionRecord, HookExecutionStatusPayload } from "@roo-code/types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

export const HooksSettings: React.FC = () => {
	const { t } = useAppTranslation()
	const { hooks } = useExtensionState()
	const [executionHistory, setExecutionHistory] = useState<HookExecutionRecord[]>(hooks?.executionHistory || [])

	// Listen for realtime hookExecutionStatus messages
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "hookExecutionStatus") {
				const payload: HookExecutionStatusPayload = message.hookExecutionStatus

				// Convert realtime status to execution record format when completed/failed
				if (payload.status === "completed" || payload.status === "failed" || payload.status === "blocked") {
					const record: HookExecutionRecord = {
						timestamp: new Date().toISOString(),
						hookId: payload.hookId || "unknown",
						event: payload.event,
						toolName: payload.toolName,
						exitCode: payload.status === "completed" ? 0 : 1,
						duration: payload.duration || 0,
						timedOut: false,
						blocked: payload.status === "blocked",
						error: payload.error,
						blockMessage: payload.blockMessage,
					}

					setExecutionHistory((prev) => [record, ...prev].slice(0, 50)) // Keep last 50
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	// Update local state when extension state changes
	useEffect(() => {
		if (hooks?.executionHistory) {
			setExecutionHistory(hooks.executionHistory)
		}
	}, [hooks?.executionHistory])

	const handleReloadConfig = useCallback(() => {
		vscode.postMessage({ type: "hooksReloadConfig" })
	}, [])

	const handleOpenConfigFolder = useCallback((source: "global" | "project") => {
		vscode.postMessage({ type: "hooksOpenConfigFolder", hooksSource: source })
	}, [])

	const handleToggleHook = useCallback((hookId: string, enabled: boolean) => {
		vscode.postMessage({ type: "hooksSetEnabled", hookId, hookEnabled: enabled })
	}, [])

	const enabledHooks = hooks?.enabledHooks || []
	const hasProjectHooks = hooks?.hasProjectHooks || false
	const snapshotTimestamp = hooks?.snapshotTimestamp

	return (
		<div>
			<SectionHeader>{t("settings:sections.hooks")}</SectionHeader>

			<Section>
				{/* Header with actions */}
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<h3 className="text-base font-medium m-0">{t("settings:hooks.configuredHooks")}</h3>
						{snapshotTimestamp && (
							<StandardTooltip
								content={t("settings:hooks.lastLoadedTooltip", {
									time: new Date(snapshotTimestamp).toLocaleString(),
								})}>
								<Clock className="w-4 h-4 text-vscode-descriptionForeground" />
							</StandardTooltip>
						)}
					</div>
					<div className="flex items-center gap-2">
						<StandardTooltip content={t("settings:hooks.reloadTooltip")}>
							<Button variant="ghost" size="sm" onClick={handleReloadConfig}>
								<RefreshCw className="w-4 h-4" />
								<span className="ml-1">{t("settings:hooks.reload")}</span>
							</Button>
						</StandardTooltip>
						<StandardTooltip
							content={
								hasProjectHooks
									? t("settings:hooks.openProjectFolderTooltip")
									: t("settings:hooks.openGlobalFolderTooltip")
							}>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleOpenConfigFolder(hasProjectHooks ? "project" : "global")}>
								<FolderOpen className="w-4 h-4" />
								<span className="ml-1">
									{hasProjectHooks
										? t("settings:hooks.openProjectFolder")
										: t("settings:hooks.openGlobalFolder")}
								</span>
							</Button>
						</StandardTooltip>
					</div>
				</div>

				{/* Security warning for project hooks */}
				{hasProjectHooks && (
					<div className="flex items-start gap-2 p-3 mb-4 rounded bg-yellow-500/10 border border-yellow-500/30">
						<AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
						<div className="text-sm">
							<div className="font-medium mb-1">{t("settings:hooks.projectHooksWarningTitle")}</div>
							<div className="text-vscode-descriptionForeground">
								{t("settings:hooks.projectHooksWarningMessage")}
							</div>
						</div>
					</div>
				)}

				{/* Note about edits requiring reload */}
				<div className="text-sm text-vscode-descriptionForeground mb-4">{t("settings:hooks.reloadNote")}</div>

				{/* Hooks list */}
				{enabledHooks.length === 0 ? (
					<div className="text-center py-8 text-vscode-descriptionForeground">
						<Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
						<p className="text-base mb-2">{t("settings:hooks.noHooksConfigured")}</p>
						<p className="text-sm">{t("settings:hooks.noHooksHint")}</p>
					</div>
				) : (
					<div className="space-y-3">
						{enabledHooks.map((hook) => (
							<HookItem key={hook.id} hook={hook} onToggle={handleToggleHook} />
						))}
					</div>
				)}

				{/* Hook Activity Log */}
				<HookActivityLog executionHistory={executionHistory} />
			</Section>
		</div>
	)
}

interface HookItemProps {
	hook: HookInfo
	onToggle: (hookId: string, enabled: boolean) => void
}

const HookItem: React.FC<HookItemProps> = ({ hook, onToggle }) => {
	const { t } = useAppTranslation()

	return (
		<div className="p-3 rounded border border-vscode-input-border bg-vscode-input-background">
			<div className="flex items-start justify-between gap-3">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-2">
						<Zap className="w-4 h-4 flex-shrink-0 text-vscode-textLink-foreground" />
						<code className="text-sm font-mono text-vscode-textLink-foreground">{hook.event}</code>
						{hook.matcher && (
							<>
								<span className="text-vscode-descriptionForeground">→</span>
								<code className="text-xs font-mono text-vscode-descriptionForeground">
									{hook.matcher}
								</code>
							</>
						)}
						<span
							className={`ml-auto text-xs px-2 py-0.5 rounded ${
								hook.source === "project"
									? "bg-yellow-500/20 text-yellow-500"
									: hook.source === "mode"
										? "bg-blue-500/20 text-blue-500"
										: "bg-gray-500/20 text-gray-400"
							}`}>
							{hook.source}
						</span>
					</div>

					{hook.description && <p className="text-sm text-vscode-foreground mb-2">{hook.description}</p>}

					<div className="flex items-center gap-3 text-xs text-vscode-descriptionForeground">
						<code className="font-mono bg-vscode-editor-background px-2 py-1 rounded">
							{hook.commandPreview}
						</code>
						{hook.shell && (
							<span>
								{t("settings:hooks.shell")}: <code className="font-mono">{hook.shell}</code>
							</span>
						)}
						<span>
							{t("settings:hooks.timeout")}: {hook.timeout}s
						</span>
					</div>
				</div>

				<label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
					<input
						type="checkbox"
						checked={hook.enabled}
						onChange={(e) => onToggle(hook.id, e.target.checked)}
						className="w-4 h-4 cursor-pointer"
					/>
					<span className="text-sm">{t("settings:hooks.enabled")}</span>
				</label>
			</div>
		</div>
	)
}

interface HookActivityLogProps {
	executionHistory: HookExecutionRecord[]
}

const HookActivityLog: React.FC<HookActivityLogProps> = ({ executionHistory }) => {
	const { t } = useAppTranslation()
	const [isExpanded, setIsExpanded] = useState(false)

	if (executionHistory.length === 0) {
		return null
	}

	return (
		<div className="mt-6">
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex items-center gap-2 text-base font-medium mb-3 hover:text-vscode-textLink-foreground transition-colors w-full text-left">
				<span
					className="transform transition-transform"
					style={{ transform: isExpanded ? "rotate(90deg)" : "" }}>
					▶
				</span>
				{t("settings:hooks.activityLog")} ({executionHistory.length})
			</button>

			{isExpanded && (
				<div className="space-y-2 max-h-96 overflow-y-auto">
					{executionHistory.map((record, index) => (
						<ActivityLogItem key={`${record.timestamp}-${index}`} record={record} />
					))}
				</div>
			)}
		</div>
	)
}

interface ActivityLogItemProps {
	record: HookExecutionRecord
}

const ActivityLogItem: React.FC<ActivityLogItemProps> = ({ record }) => {
	const { t } = useAppTranslation()

	const getStatusDisplay = () => {
		if (record.blocked) {
			return {
				label: t("settings:hooks.status.blocked"),
				className: "bg-red-500/20 text-red-500",
				icon: <X className="w-3 h-3" />,
			}
		}
		if (record.error || record.exitCode !== 0) {
			return {
				label: t("settings:hooks.status.failed"),
				className: "bg-red-500/20 text-red-500",
				icon: <X className="w-3 h-3" />,
			}
		}
		if (record.timedOut) {
			return {
				label: t("settings:hooks.status.timeout"),
				className: "bg-yellow-500/20 text-yellow-500",
				icon: <Clock className="w-3 h-3" />,
			}
		}
		return {
			label: t("settings:hooks.status.completed"),
			className: "bg-green-500/20 text-green-500",
			icon: <Zap className="w-3 h-3" />,
		}
	}

	const status = getStatusDisplay()
	const timestamp = new Date(record.timestamp)
	const timeAgo = getTimeAgo(timestamp)

	return (
		<div className="p-2 rounded border border-vscode-input-border bg-vscode-input-background text-sm">
			<div className="flex items-center justify-between gap-2 mb-1">
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<span
						className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${status.className}`}>
						{status.icon}
						{status.label}
					</span>
					<code className="text-xs font-mono text-vscode-textLink-foreground truncate">
						{record.event}
						{record.toolName && ` (${record.toolName})`}
					</code>
				</div>
				<div className="flex items-center gap-2 text-xs text-vscode-descriptionForeground flex-shrink-0">
					<span>{record.duration}ms</span>
					<StandardTooltip content={timestamp.toLocaleString()}>
						<span className="cursor-help">{timeAgo}</span>
					</StandardTooltip>
				</div>
			</div>

			{(record.error || record.blockMessage) && (
				<div className="mt-2 p-2 rounded bg-vscode-editor-background text-xs font-mono text-red-400 overflow-x-auto">
					{record.blockMessage || record.error}
				</div>
			)}
		</div>
	)
}

function getTimeAgo(date: Date): string {
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

	if (seconds < 60) return `${seconds}s ago`
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
	return `${Math.floor(seconds / 86400)}d ago`
}
