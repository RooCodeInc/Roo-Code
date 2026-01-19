import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { RefreshCw, FolderOpen, AlertTriangle, Clock, FishingHook, X, Plus, Copy } from "lucide-react"
import {
	VSCodeDropdown,
	VSCodeOption,
	VSCodePanels,
	VSCodePanelTab,
	VSCodePanelView,
} from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import {
	Button,
	SearchableSelect,
	StandardTooltip,
	ToggleSwitch,
	type SearchableSelectOption,
} from "@src/components/ui"
import type { HookInfo, HookExecutionRecord, HookExecutionStatusPayload } from "@roo-code/types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

import {
	TOOL_EVENTS,
	LIFECYCLE_EVENTS_WITH_MATCHERS,
	LIFECYCLE_EVENTS_WITHOUT_MATCHERS,
	TOOL_MATCHERS,
	SESSION_START_MATCHERS,
	NOTIFICATION_MATCHERS,
	PRE_COMPACT_MATCHERS,
	isToolEvent,
	eventSupportsMatchers,
	getValidMatchersForEvent,
	type HookEventType,
} from "../../../../src/services/hooks/types"

const TOOL_EVENT_DESCRIPTIONS: Record<(typeof TOOL_EVENTS)[number], string> = {
	PreToolUse: "Before a tool is executed",
	PostToolUse: "After a tool executes successfully",
	PostToolUseFailure: "After a tool execution fails",
	PermissionRequest: "When user is shown a permission dialog",
}

const LIFECYCLE_EVENT_DESCRIPTIONS_WITH_MATCHERS: Record<(typeof LIFECYCLE_EVENTS_WITH_MATCHERS)[number], string> = {
	SessionStart: "When a session begins",
	Notification: "When a notification is sent",
	PreCompact: "Before context compaction",
}

const LIFECYCLE_EVENT_DESCRIPTIONS_WITHOUT_MATCHERS: Record<
	(typeof LIFECYCLE_EVENTS_WITHOUT_MATCHERS)[number],
	string
> = {
	SessionEnd: "When a session ends",
	Stop: "When the main agent stops",
	SubagentStart: "When a subagent starts",
	SubagentStop: "When a subagent stops",
	UserPromptSubmit: "When user submits a prompt",
}

// Event options with descriptions for the dropdown
const EVENT_OPTIONS: { value: HookEventType; label: string; description: string; category: string }[] = [
	...TOOL_EVENTS.map((event) => ({
		value: event,
		label: event,
		description: TOOL_EVENT_DESCRIPTIONS[event],
		category: "Tool Events",
	})),
	...LIFECYCLE_EVENTS_WITH_MATCHERS.map((event) => ({
		value: event,
		label: event,
		description: LIFECYCLE_EVENT_DESCRIPTIONS_WITH_MATCHERS[event],
		category: "Lifecycle Events",
	})),
	...LIFECYCLE_EVENTS_WITHOUT_MATCHERS.map((event) => ({
		value: event,
		label: event,
		description: LIFECYCLE_EVENT_DESCRIPTIONS_WITHOUT_MATCHERS[event],
		category: "Lifecycle Events",
	})),
]

// Matcher display labels
const TOOL_MATCHER_LABELS: Record<string, string> = {
	read: "Read (file reading)",
	edit: "Edit (file writing)",
	browser: "Browser (web tools)",
	command: "Command (shell/bash)",
	mcp: "MCP (protocol tools)",
	modes: "Modes (mode tools)",
}

const SESSION_START_MATCHER_LABELS: Record<string, string> = {
	startup: "Startup (new session)",
	resume: "Resume (existing session)",
	clear: "Clear (conversation cleared)",
	compact: "Compact (context compacted)",
}

const NOTIFICATION_MATCHER_LABELS: Record<string, string> = {
	permission_prompt: "Permission Prompt",
	idle_prompt: "Idle Prompt",
	auth_success: "Auth Success",
	elicitation_dialog: "Elicitation Dialog",
}

const PRE_COMPACT_MATCHER_LABELS: Record<string, string> = {
	manual: "Manual (user triggered)",
	auto: "Auto (automatic)",
}

const TIMEOUT_OPTIONS: Array<{ label: string; seconds: number }> = [
	{ label: "15 seconds", seconds: 15 },
	{ label: "30 seconds", seconds: 30 },
	{ label: "1 minute", seconds: 60 },
	{ label: "5 minutes", seconds: 300 },
	{ label: "10 minutes", seconds: 600 },
	{ label: "15 minutes", seconds: 900 },
	{ label: "30 minutes", seconds: 1800 },
	{ label: "60 minutes", seconds: 3600 },
]

export const HooksSettings: React.FC = () => {
	const { t } = useAppTranslation()
	const { hooks, hooksEnabled } = useExtensionState()
	const [executionHistory, setExecutionHistory] = useState<HookExecutionRecord[]>(hooks?.executionHistory || [])
	const [isUpdatingEnabled, setIsUpdatingEnabled] = useState(false)
	const [pendingFocusHookId, setPendingFocusHookId] = useState<string | null>(null)

	// Master toggle state - defaults to true if not explicitly set
	const isHooksEnabled = hooksEnabled ?? true

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

			if (message.type === "hooksCopyHookResult") {
				if (message.success && message.values?.hookId) {
					setPendingFocusHookId(String(message.values.hookId))
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

	const handleToggleHooksEnabled = useCallback((enabled: boolean) => {
		setIsUpdatingEnabled(true)
		vscode.postMessage({ type: "hooksSetAllEnabled", hooksEnabled: enabled })
		// Optimistically clear the "updating" flag after a short delay.
		// The extension will send updated state via postStateToWebview().
		setTimeout(() => setIsUpdatingEnabled(false), 500)
	}, [])

	const handleCreateNewHook = useCallback(() => {
		vscode.postMessage({ type: "hooksCreateNew" })
	}, [])

	const enabledHooks = useMemo(() => {
		const list = hooks?.enabledHooks ? [...hooks.enabledHooks] : []
		// Stable ordering to prevent jitter: sort by config file creation time (oldest first).
		// Fall back to filePath/id as a deterministic tie-breaker.
		return list.sort((a, b) => {
			const aCreated = a.createdAt ?? Number.MAX_SAFE_INTEGER
			const bCreated = b.createdAt ?? Number.MAX_SAFE_INTEGER
			if (aCreated !== bCreated) return aCreated - bCreated
			const aFile = a.filePath ?? ""
			const bFile = b.filePath ?? ""
			if (aFile !== bFile) return aFile.localeCompare(bFile)
			return a.id.localeCompare(b.id)
		})
	}, [hooks?.enabledHooks])
	const hasProjectHooks = hooks?.hasProjectHooks || false
	const snapshotTimestamp = hooks?.snapshotTimestamp

	return (
		<div>
			<SectionHeader>{t("settings:sections.hooks")}</SectionHeader>

			<Section>
				{/* Description paragraph */}
				<div
					style={{
						color: "var(--vscode-foreground)",
						fontSize: "13px",
						marginBottom: "10px",
						marginTop: "5px",
					}}>
					{t("settings:hooks.description")}
				</div>

				{/* Master enable hooks toggle - always visible, similar to MCP toggle */}
				<div style={{ marginBottom: "20px" }}>
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={isHooksEnabled}
							disabled={isUpdatingEnabled}
							onChange={(e) => handleToggleHooksEnabled(e.target.checked)}
							className="w-4 h-4 cursor-pointer"
						/>
						<span style={{ fontWeight: "500" }}>{t("settings:hooks.enableHooks")}</span>
					</label>
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						{t("settings:hooks.enableHooksDescription")}
					</p>
				</div>

				{/* Only show the rest of the content when hooks are enabled */}
				{isHooksEnabled && (
					<>
						{/* Header */}
						<div className="flex items-center gap-2 mb-4">
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

						{/* Security warning for project hooks */}
						{hasProjectHooks && (
							<div className="flex items-start gap-2 p-3 mb-4 rounded bg-yellow-500/10 border border-yellow-500/30">
								<AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
								<div className="text-sm">
									<div className="font-medium mb-1">
										{t("settings:hooks.projectHooksWarningTitle")}
									</div>
									<div className="text-vscode-descriptionForeground">
										{t("settings:hooks.projectHooksWarningMessage")}
									</div>
								</div>
							</div>
						)}

						{/* Note about edits requiring reload */}
						<div className="text-sm text-vscode-descriptionForeground mb-4">
							{t("settings:hooks.reloadNote")}
							<br />
							{t("settings:hooks.matcherNote")}
							<br />
							<span className="font-medium">{t("settings:hooks.matcherExamplesLabel")}</span>
							<ul className="list-disc list-inside mt-1">
								<li>
									<code className="font-mono">{t("settings:hooks.matcherExamples.writeOrEdit")}</code>
								</li>
								<li>
									<code className="font-mono">{t("settings:hooks.matcherExamples.readOnly")}</code>
								</li>
							</ul>
						</div>

						{/* Hooks list */}
						{enabledHooks.length === 0 ? (
							<div className="text-center py-8 text-vscode-descriptionForeground">
								<FishingHook className="w-12 h-12 mx-auto mb-3 opacity-50" />
								<p className="text-base mb-2">{t("settings:hooks.noHooksConfigured")}</p>
								<p className="text-sm">{t("settings:hooks.noHooksHint")}</p>
							</div>
						) : (
							<div className="space-y-3">
								{enabledHooks.map((hook) => (
									<HookItem
										key={hook.id}
										hook={hook}
										onToggle={handleToggleHook}
										autoExpandHookId={pendingFocusHookId}
										onAutoExpanded={() => setPendingFocusHookId(null)}
									/>
								))}
							</div>
						)}

						{/* Hook Activity Log */}
						<HookActivityLog executionHistory={executionHistory} />

						{/* Bottom Action Buttons - mirroring MCP settings order: create, global, project, refresh */}
						<div
							style={{
								marginTop: "10px",
								width: "100%",
								display: "grid",
								gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
								gap: "10px",
							}}>
							<Button variant="secondary" style={{ width: "100%" }} onClick={handleCreateNewHook}>
								<Plus className="w-4 h-4" />
								<span className="ml-2">{t("settings:hooks.createNewHook")}</span>
							</Button>
							<Button
								variant="secondary"
								style={{ width: "100%" }}
								onClick={() => handleOpenConfigFolder("global")}>
								<FolderOpen className="w-4 h-4" />
								<span className="ml-2">{t("settings:hooks.openGlobalFolder")}</span>
							</Button>
							<Button
								variant="secondary"
								style={{ width: "100%" }}
								onClick={() => handleOpenConfigFolder("project")}>
								<FolderOpen className="w-4 h-4" />
								<span className="ml-2">{t("settings:hooks.openProjectFolder")}</span>
							</Button>
							<StandardTooltip content={t("settings:hooks.reloadTooltip")}>
								<Button variant="secondary" style={{ width: "100%" }} onClick={handleReloadConfig}>
									<RefreshCw className="w-4 h-4" />
									<span className="ml-2">{t("settings:hooks.reload")}</span>
								</Button>
							</StandardTooltip>
						</div>
					</>
				)}
			</Section>
		</div>
	)
}

interface HookItemProps {
	hook: HookInfo
	onToggle: (hookId: string, enabled: boolean) => void
	autoExpandHookId?: string | null
	onAutoExpanded?: () => void
}

const HookItem: React.FC<HookItemProps> = ({ hook, onToggle, autoExpandHookId, onAutoExpanded }) => {
	const { t } = useAppTranslation()
	const { hooks } = useExtensionState()
	const [isExpanded, setIsExpanded] = useState(false)
	const [hookLogs, setHookLogs] = useState<HookExecutionRecord[]>([])
	const [isUpdatingConfig, setIsUpdatingConfig] = useState(false)
	const [hookIdDraft, setHookIdDraft] = useState(hook.id)
	const [hookIdError, setHookIdError] = useState<string | null>(null)
	const [commandDraft, setCommandDraft] = useState(hook.commandPreview)
	const commandTextAreaRef = useRef<HTMLTextAreaElement | null>(null)

	const canEditConfig = Boolean(hook.filePath)

	const selectedEvent = useMemo<HookEventType | "">(() => {
		// Prefer events array if present, take first event
		if (hook.events && hook.events.length > 0) {
			return hook.events[0] as HookEventType
		}
		// Fall back to legacy event field
		if (hook.event) {
			return hook.event as HookEventType
		}
		return ""
	}, [hook.events, hook.event])

	const eventOptions = useMemo<SearchableSelectOption[]>(() => {
		return EVENT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))
	}, [])

	const { matcherGroups, matcherCustom: initialMatcherCustom } = useMemo(() => {
		const matcher = hook.matcher || ""
		if (!selectedEvent || !eventSupportsMatchers(selectedEvent)) {
			return { matcherGroups: [] as string[], matcherCustom: "" }
		}

		const validMatchers = getValidMatchersForEvent(selectedEvent) || []
		const parts = matcher
			.split("|")
			.map((p) => p.trim())
			.filter((p) => p.length > 0)

		const groups = parts.filter((p) => (validMatchers as readonly string[]).includes(p))
		const custom = parts.filter((p) => !(validMatchers as readonly string[]).includes(p)).join("|")

		return { matcherGroups: groups, matcherCustom: custom }
	}, [hook.matcher, selectedEvent])

	const [matcherCustom, setMatcherCustom] = useState(initialMatcherCustom)

	useEffect(() => {
		setMatcherCustom(initialMatcherCustom)
	}, [initialMatcherCustom])

	useEffect(() => {
		setHookIdDraft(hook.id)
		setHookIdError(null)
	}, [hook.id])

	useEffect(() => {
		setCommandDraft(hook.commandPreview)
	}, [hook.commandPreview])

	const timeoutSeconds = hook.timeout
	const timeoutSelection = useMemo(() => {
		const match = TIMEOUT_OPTIONS.find((o) => o.seconds === timeoutSeconds)
		return match?.seconds ?? TIMEOUT_OPTIONS[1].seconds
	}, [timeoutSeconds])

	const postHookUpdate = useCallback(
		(updates: {
			events?: HookEventType[]
			matcher?: string | undefined
			timeout?: number
			id?: string
			command?: string
		}) => {
			if (!hook.filePath) return
			setIsUpdatingConfig(true)
			vscode.postMessage({
				type: "hooksUpdateHook",
				hookId: hook.id,
				filePath: hook.filePath,
				hookUpdates: updates,
			})
			setTimeout(() => setIsUpdatingConfig(false), 500)
		},
		[hook.filePath, hook.id],
	)

	const buildMatcherString = useCallback((groups: string[], custom: string): string => {
		const parts = [...groups]
		if (custom.trim()) {
			parts.push(custom.trim())
		}
		return parts.join("|")
	}, [])

	const handleEventChange = useCallback(
		(newEvent: HookEventType) => {
			let newMatcher = hook.matcher

			if (!eventSupportsMatchers(newEvent)) {
				newMatcher = undefined
			} else if (selectedEvent && isToolEvent(selectedEvent) !== isToolEvent(newEvent)) {
				newMatcher = undefined
				setMatcherCustom("")
			}

			postHookUpdate({
				events: [newEvent],
				matcher: newMatcher,
			})
		},
		[hook.matcher, postHookUpdate, selectedEvent],
	)

	const handleMatcherGroupToggle = useCallback(
		(matcher: string) => {
			const newGroups = matcherGroups.includes(matcher)
				? matcherGroups.filter((g) => g !== matcher)
				: [...matcherGroups, matcher]

			const newMatcher = buildMatcherString(newGroups, matcherCustom)
			postHookUpdate({ matcher: newMatcher || undefined })
		},
		[buildMatcherString, matcherCustom, matcherGroups, postHookUpdate],
	)

	const handleMatcherSave = useCallback(() => {
		const newMatcher = buildMatcherString(matcherGroups, matcherCustom)
		postHookUpdate({ matcher: newMatcher || undefined })
	}, [buildMatcherString, matcherCustom, matcherGroups, postHookUpdate])

	const validateHookIdDraft = useCallback(
		(nextId: string): string | null => {
			const trimmed = nextId.trim()
			if (trimmed.length === 0) return t("settings:hooks.idErrors.required")
			if (trimmed.length > 100) return t("settings:hooks.idErrors.maxLength")
			if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return t("settings:hooks.idErrors.invalidChars")

			// Best-effort client-side uniqueness check within current view.
			const enabledHooks = hooks?.enabledHooks ?? []
			const duplicate = enabledHooks.some(
				(h) => h.filePath === hook.filePath && h.id === trimmed && h.id !== hook.id,
			)
			if (duplicate) return t("settings:hooks.idErrors.notUnique")
			return null
		},
		[hooks?.enabledHooks, hook.filePath, hook.id, t],
	)

	const handleSaveHookId = useCallback(() => {
		if (!canEditConfig) return
		const error = validateHookIdDraft(hookIdDraft)
		setHookIdError(error)
		if (error) return
		const trimmed = hookIdDraft.trim()
		if (trimmed === hook.id) return
		postHookUpdate({ id: trimmed })
	}, [canEditConfig, hook.id, hookIdDraft, postHookUpdate, validateHookIdDraft])

	const handleCopyHook = useCallback(() => {
		if (!hook.filePath) return
		vscode.postMessage({
			type: "hooksCopyHook",
			hookId: hook.id,
		})
	}, [hook.filePath, hook.id])

	const handleSaveCommand = useCallback(() => {
		if (!canEditConfig) return
		const trimmed = commandDraft.trim()
		if (trimmed.length === 0) {
			return
		}
		postHookUpdate({ command: commandDraft })
	}, [canEditConfig, commandDraft, postHookUpdate])

	const handleCommandKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key !== "Tab") return
			e.preventDefault()
			const el = e.currentTarget
			const start = el.selectionStart ?? 0
			const end = el.selectionEnd ?? 0
			const next = `${commandDraft.slice(0, start)}\t${commandDraft.slice(end)}`
			setCommandDraft(next)
			// Re-position cursor after state update.
			requestAnimationFrame(() => {
				if (!commandTextAreaRef.current) return
				commandTextAreaRef.current.selectionStart = start + 1
				commandTextAreaRef.current.selectionEnd = start + 1
			})
		},
		[commandDraft],
	)

	// Filter execution history for this specific hook
	useEffect(() => {
		const history = hooks?.executionHistory || []
		const filtered = history.filter((record) => record.hookId === hook.id)
		setHookLogs(filtered)
	}, [hooks?.executionHistory, hook.id])

	// Listen for realtime hookExecutionStatus messages for this hook
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "hookExecutionStatus") {
				const payload: HookExecutionStatusPayload = message.hookExecutionStatus

				// Only process messages for this specific hook
				if (payload.hookId === hook.id) {
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

						setHookLogs((prev) => [record, ...prev].slice(0, 20)) // Keep last 20 per hook
					}
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [hook.id])

	const handleToggleEnabled = () => {
		onToggle(hook.id, !hook.enabled)
	}

	const handleDeleteHook = () => {
		vscode.postMessage({
			type: "hooksDeleteHook",
			hookId: hook.id,
			hooksSource: hook.source,
		})
	}

	const handleOpenHookFile = () => {
		if (!hook.filePath) return
		vscode.postMessage({
			type: "hooksOpenHookFile",
			filePath: hook.filePath,
		})
	}

	useEffect(() => {
		if (!autoExpandHookId) return
		if (autoExpandHookId !== hook.id) return
		setIsExpanded(true)
		onAutoExpanded?.()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoExpandHookId, hook.id])

	const getEnabledDotColor = () => {
		return hook.enabled ? "var(--vscode-testing-iconPassed)" : "var(--vscode-descriptionForeground)"
	}

	return (
		<div className="rounded bg-vscode-input-background">
			{/* Collapsed Header */}
			<div
				className="flex items-center gap-3 p-3 cursor-pointer hover:bg-vscode-list-hoverBackground"
				onClick={() => setIsExpanded(!isExpanded)}>
				<span
					className="transform transition-transform"
					style={{ transform: isExpanded ? "rotate(90deg)" : "" }}>
					▶
				</span>
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<FishingHook className="w-4 h-4 flex-shrink-0 text-vscode-textLink-foreground" />
					<code className="text-sm font-mono text-vscode-textLink-foreground truncate">{hook.id}</code>
					<div className="flex items-center gap-2 min-w-0">
						<span className="text-vscode-descriptionForeground">·</span>
						<div className="flex items-center gap-2 min-w-0">
							<span className="text-xs font-medium text-vscode-foreground truncate">
								{selectedEvent || "No event"}
							</span>
							{selectedEvent && eventSupportsMatchers(selectedEvent) && hook.matcher && (
								<span className="text-xs text-vscode-descriptionForeground truncate">
									[{hook.matcher}]
								</span>
							)}
						</div>
					</div>
					<span
						className={`ml-auto text-xs px-2 py-0.5 rounded flex-shrink-0 ${
							hook.source === "project"
								? "bg-yellow-500/20 text-yellow-500"
								: hook.source === "mode"
									? "bg-blue-500/20 text-blue-500"
									: "bg-gray-500/20 text-gray-400"
						}`}>
						{hook.source}
					</span>
				</div>
				<div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
					<StandardTooltip content={t("settings:hooks.copyHook")}>
						<Button
							variant="ghost"
							size="icon"
							onClick={handleCopyHook}
							disabled={!hook.filePath}
							data-testid={`hook-copy-${hook.id}`}
							aria-label={t("settings:hooks.copyHook")}>
							<Copy className="w-4 h-4" />
						</Button>
					</StandardTooltip>
					<Button
						variant="ghost"
						size="icon"
						onClick={handleDeleteHook}
						data-testid={`hook-delete-${hook.id}`}
						aria-label={t("settings:hooks.deleteHook")}>
						<span className="codicon codicon-trash" style={{ fontSize: "14px" }}></span>
					</Button>
					<StandardTooltip
						content={
							hook.filePath
								? t("settings:hooks.openHookFileTooltip")
								: t("settings:hooks.openHookFileUnavailableTooltip")
						}>
						<Button
							variant="ghost"
							size="icon"
							onClick={handleOpenHookFile}
							disabled={!hook.filePath}
							data-testid={`hook-open-file-${hook.id}`}
							aria-label={t("settings:hooks.openHookFile")}
							style={{ marginRight: "6px" }}>
							<span className="codicon codicon-link-external" style={{ fontSize: "14px" }}></span>
						</Button>
					</StandardTooltip>
					<div
						data-testid={`hook-status-dot-${hook.id}`}
						style={{
							width: "8px",
							height: "8px",
							borderRadius: "50%",
							background: getEnabledDotColor(),
							marginLeft: "2px",
						}}
					/>
					<ToggleSwitch
						checked={hook.enabled}
						onChange={handleToggleEnabled}
						size="medium"
						aria-label={t("settings:hooks.enabled")}
						data-testid={`hook-enabled-toggle-${hook.id}`}
					/>
				</div>
			</div>

			{/* Expanded Content */}
			{isExpanded && (
				<div className="p-3">
					<VSCodePanels>
						<VSCodePanelTab id="config">{t("settings:hooks.tabs.config")}</VSCodePanelTab>
						<VSCodePanelTab id="command">{t("settings:hooks.tabs.command")}</VSCodePanelTab>
						<VSCodePanelTab id="logs">
							{t("settings:hooks.tabs.logs")}
							{hookLogs.length > 0 && <span className="ml-1 opacity-60">({hookLogs.length})</span>}
						</VSCodePanelTab>

						{/* VSCodePanels matches tabs to views by id. */}
						<VSCodePanelView id="config">
							<div className="flex flex-col gap-3 pt-3 w-full">
								<div>
									<span className="text-xs font-medium text-vscode-descriptionForeground block mb-1">
										{t("settings:hooks.hookId")}
									</span>
									<input
										className={`w-full text-xs bg-vscode-input-background border rounded px-2 py-1 text-vscode-foreground ${
											hookIdError ? "border-red-500" : "border-vscode-input-border"
										}`}
										value={hookIdDraft}
										disabled={!canEditConfig || isUpdatingConfig}
										onChange={(e) => {
											setHookIdDraft(e.target.value)
											if (hookIdError) {
												setHookIdError(validateHookIdDraft(e.target.value))
											}
										}}
										onBlur={handleSaveHookId}
										placeholder="my-hook"
									/>
									{hookIdError && <div className="text-xs text-red-400 mt-1">{hookIdError}</div>}
								</div>

								<div>
									{/* Event Type Dropdown */}
									<div className="flex flex-col gap-1">
										<label className="text-xs font-medium text-vscode-descriptionForeground">
											Event Type
										</label>
										<SearchableSelect
											value={selectedEvent || undefined}
											disabled={!canEditConfig || isUpdatingConfig}
											onValueChange={(value) => handleEventChange(value as HookEventType)}
											options={eventOptions}
											placeholder="Select event type..."
											searchPlaceholder="Search events..."
											emptyMessage="No matching events found."
											className="min-w-[200px]"
											data-testid={`hook-event-select-${hook.id}`}
										/>
										{selectedEvent && (
											<span className="text-xs text-vscode-descriptionForeground">
												{EVENT_OPTIONS.find((o) => o.value === selectedEvent)?.description}
											</span>
										)}
									</div>

									{/* Dynamic Matcher Section */}
									{selectedEvent && (
										<div className="flex flex-col gap-2 mt-2">
											<label className="text-xs font-medium text-vscode-descriptionForeground">
												Matchers
											</label>

											{!eventSupportsMatchers(selectedEvent) ? (
												<div className="flex items-center gap-2 text-xs text-vscode-descriptionForeground bg-vscode-editor-background rounded p-2">
													<span className="codicon codicon-info" />
													<span>
														This event type does not use matchers - the hook will fire for
														all occurrences.
													</span>
												</div>
											) : isToolEvent(selectedEvent) ? (
												<div className="flex flex-col gap-2">
													<div className="grid grid-cols-3 gap-2">
														{TOOL_MATCHERS.map((matcher) => (
															<label
																key={matcher}
																className="flex items-center gap-1 text-xs cursor-pointer">
																<input
																	type="checkbox"
																	disabled={!canEditConfig || isUpdatingConfig}
																	checked={matcherGroups.includes(matcher)}
																	onChange={() => handleMatcherGroupToggle(matcher)}
																	className="accent-vscode-button-background"
																/>
																<span>{TOOL_MATCHER_LABELS[matcher] || matcher}</span>
															</label>
														))}
													</div>
													<div className="flex flex-col gap-1">
														<label className="text-xs text-vscode-descriptionForeground">
															Custom pattern (regex/glob):
														</label>
														<input
															type="text"
															disabled={!canEditConfig || isUpdatingConfig}
															value={matcherCustom}
															onChange={(e) => setMatcherCustom(e.target.value)}
															onBlur={handleMatcherSave}
															placeholder="e.g., Write|Edit or mcp__memory__.*"
															className="bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded px-2 py-1 text-xs"
														/>
													</div>
												</div>
											) : selectedEvent === "SessionStart" ? (
												<div className="grid grid-cols-2 gap-2">
													{SESSION_START_MATCHERS.map((matcher) => (
														<label
															key={matcher}
															className="flex items-center gap-1 text-xs cursor-pointer">
															<input
																type="checkbox"
																disabled={!canEditConfig || isUpdatingConfig}
																checked={matcherGroups.includes(matcher)}
																onChange={() => handleMatcherGroupToggle(matcher)}
																className="accent-vscode-button-background"
															/>
															<span>
																{SESSION_START_MATCHER_LABELS[matcher] || matcher}
															</span>
														</label>
													))}
												</div>
											) : selectedEvent === "Notification" ? (
												<div className="grid grid-cols-2 gap-2">
													{NOTIFICATION_MATCHERS.map((matcher) => (
														<label
															key={matcher}
															className="flex items-center gap-1 text-xs cursor-pointer">
															<input
																type="checkbox"
																disabled={!canEditConfig || isUpdatingConfig}
																checked={matcherGroups.includes(matcher)}
																onChange={() => handleMatcherGroupToggle(matcher)}
																className="accent-vscode-button-background"
															/>
															<span>
																{NOTIFICATION_MATCHER_LABELS[matcher] || matcher}
															</span>
														</label>
													))}
												</div>
											) : selectedEvent === "PreCompact" ? (
												<div className="grid grid-cols-2 gap-2">
													{PRE_COMPACT_MATCHERS.map((matcher) => (
														<label
															key={matcher}
															className="flex items-center gap-1 text-xs cursor-pointer">
															<input
																type="checkbox"
																disabled={!canEditConfig || isUpdatingConfig}
																checked={matcherGroups.includes(matcher)}
																onChange={() => handleMatcherGroupToggle(matcher)}
																className="accent-vscode-button-background"
															/>
															<span>
																{PRE_COMPACT_MATCHER_LABELS[matcher] || matcher}
															</span>
														</label>
													))}
												</div>
											) : null}
										</div>
									)}

									{!canEditConfig && (
										<div className="text-xs text-vscode-descriptionForeground mt-2">
											{t("settings:hooks.openHookFileUnavailableTooltip")}
										</div>
									)}
								</div>

								<div>
									<span className="text-xs font-medium text-vscode-descriptionForeground block mb-2">
										{t("settings:hooks.timeout")}
									</span>
									<VSCodeDropdown
										disabled={!canEditConfig || isUpdatingConfig}
										value={String(timeoutSelection)}
										onChange={(e: any) => {
											const seconds = Number(e.target.value)
											postHookUpdate({ timeout: seconds })
										}}>
										{TIMEOUT_OPTIONS.map((opt) => (
											<VSCodeOption key={opt.seconds} value={String(opt.seconds)}>
												{opt.label}
											</VSCodeOption>
										))}
									</VSCodeDropdown>
								</div>

								{hook.shell && (
									<div>
										<span className="text-xs font-medium text-vscode-descriptionForeground block mb-1">
											{t("settings:hooks.shell")}
										</span>
										<code className="text-xs font-mono text-vscode-foreground bg-vscode-textCodeBlock-background px-1.5 py-0.5 rounded">
											{hook.shell}
										</code>
									</div>
								)}

								{hook.description && (
									<div>
										<span className="text-xs font-medium text-vscode-descriptionForeground block mb-1">
											{t("settings:hooks.description")}
										</span>
										<p className="text-xs text-vscode-foreground">{hook.description}</p>
									</div>
								)}
							</div>
						</VSCodePanelView>

						<VSCodePanelView id="command">
							<div className="pt-3 w-full">
								<span className="text-xs font-medium text-vscode-descriptionForeground block mb-2">
									{t("settings:hooks.command")}
								</span>
								<textarea
									ref={commandTextAreaRef}
									data-testid={`command-textarea-${hook.id}`}
									className="w-full text-xs font-mono bg-vscode-input-background border border-vscode-input-border rounded px-2 py-2 text-vscode-foreground min-h-32"
									value={commandDraft}
									disabled={!canEditConfig || isUpdatingConfig}
									onChange={(e) => setCommandDraft(e.target.value)}
									onBlur={handleSaveCommand}
									onKeyDown={handleCommandKeyDown}
									spellCheck={false}
								/>
								<div className="text-xs text-vscode-descriptionForeground mt-2">
									{t("settings:hooks.commandHint")}
								</div>
							</div>
						</VSCodePanelView>

						<VSCodePanelView id="logs">
							<div className="pt-3 w-full">
								{hookLogs.length === 0 ? (
									<div className="text-xs text-vscode-descriptionForeground">
										{t("settings:hooks.noLogsForHook")}
									</div>
								) : (
									<div className="space-y-2 max-h-48 overflow-y-auto">
										{hookLogs.map((record, index) => (
											<HookLogItem key={`${record.timestamp}-${index}`} record={record} />
										))}
									</div>
								)}
							</div>
						</VSCodePanelView>
					</VSCodePanels>
				</div>
			)}
		</div>
	)
}

interface HookLogItemProps {
	record: HookExecutionRecord
}

const HookLogItem: React.FC<HookLogItemProps> = ({ record }) => {
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
			icon: <FishingHook className="w-3 h-3" />,
		}
	}

	const status = getStatusDisplay()
	const timestamp = new Date(record.timestamp)
	const timeAgo = getTimeAgo(timestamp)

	return (
		<div className="p-2 rounded border border-vscode-input-border bg-vscode-editor-background text-xs">
			<div className="flex items-center justify-between gap-2 mb-1">
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<span
						className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${status.className}`}>
						{status.icon}
						{status.label}
					</span>
					{record.toolName && (
						<code
							data-testid="log-tool-name"
							className="text-xs font-mono text-vscode-descriptionForeground break-words">
							{record.toolName}
						</code>
					)}
				</div>
				<div className="flex items-center gap-2 text-xs text-vscode-descriptionForeground flex-shrink-0">
					<span>{record.duration}ms</span>
					<StandardTooltip content={timestamp.toLocaleString()}>
						<span className="cursor-help">{timeAgo}</span>
					</StandardTooltip>
				</div>
			</div>

			{(record.error || record.blockMessage) && (
				<div className="mt-1 p-2 rounded bg-vscode-input-background text-xs font-mono text-red-400 overflow-x-auto">
					{record.blockMessage || record.error}
				</div>
			)}
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
			icon: <FishingHook className="w-3 h-3" />,
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
					<code className="text-xs font-mono text-vscode-textLink-foreground truncate" title={record.hookId}>
						{record.hookId}
					</code>
					<span className="text-vscode-descriptionForeground">·</span>
					<code className="text-xs font-mono text-vscode-descriptionForeground truncate">
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
