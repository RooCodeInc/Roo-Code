import React, {
	forwardRef,
	memo,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import {
	CheckCheck,
	SquareMousePointer,
	Webhook,
	GitBranch,
	Bell,
	Database,
	SquareTerminal,
	FlaskConical,
	AlertTriangle,
	Globe,
	Info,
	MessageSquare,
	LucideIcon,
} from "lucide-react"

import type { ProviderSettings, ExperimentId, TelemetrySetting } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"
import { cn } from "@src/lib/utils"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { ExtensionStateContextType, useExtensionState } from "@src/context/ExtensionStateContext"
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogCancel,
	AlertDialogAction,
	AlertDialogHeader,
	AlertDialogFooter,
	Button,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
	StandardTooltip,
} from "@src/components/ui"

import { Tab, TabContent, TabHeader, TabList, TabTrigger } from "../common/Tab"
import { SetCachedStateField, SetExperimentEnabled } from "./types"
import { SectionHeader } from "./SectionHeader"
import ApiConfigManager from "./ApiConfigManager"
import ApiOptions from "./ApiOptions"
import { AutoApproveSettings } from "./AutoApproveSettings"
import { BrowserSettings } from "./BrowserSettings"
import { CheckpointSettings } from "./CheckpointSettings"
import { NotificationSettings } from "./NotificationSettings"
import { ContextManagementSettings } from "./ContextManagementSettings"
import { TerminalSettings } from "./TerminalSettings"
import { ExperimentalSettings } from "./ExperimentalSettings"
import { LanguageSettings } from "./LanguageSettings"
import { About } from "./About"
import { Section } from "./Section"
import PromptsSettings from "./PromptsSettings"

export const settingsTabsContainer = "flex flex-1 overflow-hidden [&.narrow_.tab-label]:hidden"
export const settingsTabList =
	"w-48 data-[compact=true]:w-12 flex-shrink-0 flex flex-col overflow-y-auto overflow-x-hidden border-r border-vscode-sideBar-background"
export const settingsTabTrigger =
	"whitespace-nowrap overflow-hidden min-w-0 h-12 px-4 py-3 box-border flex items-center border-l-2 border-transparent text-vscode-foreground opacity-70 hover:bg-vscode-list-hoverBackground data-[compact=true]:w-12 data-[compact=true]:p-4"
export const settingsTabTriggerActive = "opacity-100 border-vscode-focusBorder bg-vscode-list-activeSelectionBackground"

export interface SettingsViewRef {
	checkUnsaveChanges: (then: () => void) => void
}

const sectionNames = [
	"providers",
	"autoApprove",
	"browser",
	"checkpoints",
	"notifications",
	"contextManagement",
	"terminal",
	"prompts",
	"experimental",
	"language",
	"about",
] as const

type SectionName = (typeof sectionNames)[number]

type SettingsViewProps = {
	onDone: () => void
	targetSection?: string
}

const SettingsView = forwardRef<SettingsViewRef, SettingsViewProps>(({ onDone, targetSection }, ref) => {
	const { t } = useAppTranslation()

	const extensionState = useExtensionState()
	const { currentApiConfigName, listApiConfigMeta, uriScheme, settingsImportedAt } = extensionState

	const [isDiscardDialogShow, setDiscardDialogShow] = useState(false)
	const [isChangeDetected, setChangeDetected] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
	const [activeTab, setActiveTab] = useState<SectionName>(
		targetSection && sectionNames.includes(targetSection as SectionName)
			? (targetSection as SectionName)
			: "providers",
	)

	const scrollPositions = useRef<Record<SectionName, number>>(
		Object.fromEntries(sectionNames.map((s) => [s, 0])) as Record<SectionName, number>,
	)
	const contentRef = useRef<HTMLDivElement | null>(null)

	const prevApiConfigName = useRef(currentApiConfigName)
	const confirmDialogHandler = useRef<() => void>()

	const [cachedState, setCachedState] = useState(extensionState)

	const {
		alwaysAllowReadOnly,
		alwaysAllowReadOnlyOutsideWorkspace,
		allowedCommands,
		deniedCommands,
		allowedMaxRequests,
		allowedMaxCost,
		language,
		alwaysAllowBrowser,
		alwaysAllowExecute,
		alwaysAllowMcp,
		alwaysAllowModeSwitch,
		alwaysAllowSubtasks,
		alwaysAllowWrite,
		alwaysAllowWriteOutsideWorkspace,
		alwaysAllowWriteProtected,
		alwaysApproveResubmit,
		autoCondenseContext,
		autoCondenseContextPercent,
		browserToolEnabled,
		browserViewportSize,
		enableCheckpoints,
		diffEnabled,
		experiments,
		fuzzyMatchThreshold,
		maxOpenTabsContext,
		maxWorkspaceFiles,
		mcpEnabled,
		requestDelaySeconds,
		remoteBrowserHost,
		screenshotQuality,
		soundEnabled,
		ttsEnabled,
		ttsSpeed,
		soundVolume,
		telemetrySetting,
		terminalOutputLineLimit,
		terminalOutputCharacterLimit,
		terminalShellIntegrationTimeout,
		terminalShellIntegrationDisabled, // Added from upstream
		terminalCommandDelay,
		terminalPowershellCounter,
		terminalZshClearEolMark,
		terminalZshOhMy,
		terminalZshP10k,
		terminalZdotdir,
		writeDelayMs,
		showRooIgnoredFiles,
		remoteBrowserEnabled,
		maxReadFileLine,
		maxImageFileSize,
		maxTotalImageSize,
		terminalCompressProgressBar,
		maxConcurrentFileReads,
		condensingApiConfigId,
		customCondensingPrompt,
		customSupportPrompts,
		profileThresholds,
		alwaysAllowFollowupQuestions,
		alwaysAllowUpdateTodoList,
		followupAutoApproveTimeoutMs,
		includeDiagnosticMessages,
		maxDiagnosticMessages,
		includeTaskHistoryInEnhance,
		openRouterImageApiKey,
		openRouterImageGenerationSelectedModel,
	} = cachedState

	const apiConfiguration = useMemo(() => cachedState.apiConfiguration ?? {}, [cachedState.apiConfiguration])

	useEffect(() => {
		// Update only when currentApiConfigName is changed.
		// Expected to be triggered by loadApiConfiguration/upsertApiConfiguration.
		if (prevApiConfigName.current === currentApiConfigName) {
			return
		}

		setCachedState((prevCachedState) => ({ ...prevCachedState, ...extensionState }))
		prevApiConfigName.current = currentApiConfigName
		setChangeDetected(false)
	}, [currentApiConfigName, extensionState, isChangeDetected])

	// Bust the cache when settings are imported.
	useEffect(() => {
		if (settingsImportedAt) {
			setCachedState((prevCachedState) => ({ ...prevCachedState, ...extensionState }))
			setChangeDetected(false)
		}
	}, [settingsImportedAt, extensionState])

	const setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType> = useCallback(
		(field, value) => {
			setCachedState((prevState) => {
				if (prevState[field] === value) {
					return prevState
				}

				const newState = { ...prevState, [field]: value }

				// Check if any field in the new state differs from the original extension state
				// This properly handles toggling back to original values
				let hasAnyChanges = false
				for (const key in newState) {
					if (key === "apiConfiguration") continue // Handle separately
					const cachedValue = newState[key as keyof ExtensionStateContextType]
					const originalValue = extensionState[key as keyof ExtensionStateContextType]
					if (hasChanged(cachedValue, originalValue)) {
						hasAnyChanges = true
						break
					}
				}

				// Also check apiConfiguration if it exists
				if (!hasAnyChanges && newState.apiConfiguration && extensionState.apiConfiguration) {
					hasAnyChanges = hasChanged(newState.apiConfiguration, extensionState.apiConfiguration)
				}

				setChangeDetected(hasAnyChanges)
				return newState
			})
		},
		[extensionState],
	)

	const setApiConfigurationField = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K], isUserAction: boolean = true) => {
			setCachedState((prevState) => {
				if (prevState.apiConfiguration?.[field] === value) {
					return prevState
				}

				const previousValue = prevState.apiConfiguration?.[field]

				// Only skip change detection for automatic initialization (not user actions)
				// This prevents the dirty state when the component initializes and auto-syncs values
				const isInitialSync = !isUserAction && previousValue === undefined && value !== undefined

				const newState = {
					...prevState,
					apiConfiguration: { ...prevState.apiConfiguration, [field]: value },
				}

				if (!isInitialSync) {
					// Check if any field in the new state differs from the original extension state
					let hasAnyChanges = false

					// Check non-apiConfiguration fields
					for (const key in newState) {
						if (key === "apiConfiguration") continue
						const cachedValue = newState[key as keyof ExtensionStateContextType]
						const originalValue = extensionState[key as keyof ExtensionStateContextType]
						if (hasChanged(cachedValue, originalValue)) {
							hasAnyChanges = true
							break
						}
					}

					// Check apiConfiguration
					if (!hasAnyChanges && newState.apiConfiguration && extensionState.apiConfiguration) {
						hasAnyChanges = hasChanged(newState.apiConfiguration, extensionState.apiConfiguration)
					}

					setChangeDetected(hasAnyChanges)
				}

				return newState
			})
		},
		[extensionState],
	)

	const setExperimentEnabled: SetExperimentEnabled = useCallback(
		(id: ExperimentId, enabled: boolean) => {
			setCachedState((prevState) => {
				if (prevState.experiments?.[id] === enabled) {
					return prevState
				}

				const newState = { ...prevState, experiments: { ...prevState.experiments, [id]: enabled } }

				// Check if experiments differ from original
				const hasExperimentChanges = hasChanged(newState.experiments, extensionState.experiments)

				// Check other fields for changes
				let hasOtherChanges = false
				for (const key in newState) {
					if (key === "experiments" || key === "apiConfiguration") continue
					const cachedValue = newState[key as keyof ExtensionStateContextType]
					const originalValue = extensionState[key as keyof ExtensionStateContextType]
					if (hasChanged(cachedValue, originalValue)) {
						hasOtherChanges = true
						break
					}
				}

				// Check apiConfiguration
				if (!hasOtherChanges && newState.apiConfiguration && extensionState.apiConfiguration) {
					hasOtherChanges = hasChanged(newState.apiConfiguration, extensionState.apiConfiguration)
				}

				setChangeDetected(hasExperimentChanges || hasOtherChanges)
				return newState
			})
		},
		[extensionState],
	)

	const setTelemetrySetting = useCallback(
		(setting: TelemetrySetting) => {
			setCachedState((prevState) => {
				if (prevState.telemetrySetting === setting) {
					return prevState
				}

				const newState = { ...prevState, telemetrySetting: setting }

				// Check if telemetry setting differs from original
				const hasTelemetryChange = newState.telemetrySetting !== extensionState.telemetrySetting

				// Check other fields for changes
				let hasOtherChanges = false
				for (const key in newState) {
					if (key === "telemetrySetting" || key === "apiConfiguration") continue
					const cachedValue = newState[key as keyof ExtensionStateContextType]
					const originalValue = extensionState[key as keyof ExtensionStateContextType]
					if (hasChanged(cachedValue, originalValue)) {
						hasOtherChanges = true
						break
					}
				}

				// Check apiConfiguration
				if (!hasOtherChanges && newState.apiConfiguration && extensionState.apiConfiguration) {
					hasOtherChanges = hasChanged(newState.apiConfiguration, extensionState.apiConfiguration)
				}

				setChangeDetected(hasTelemetryChange || hasOtherChanges)
				return newState
			})
		},
		[extensionState],
	)

	const setOpenRouterImageApiKey = useCallback(
		(apiKey: string) => {
			setCachedState((prevState) => {
				if (prevState.openRouterImageApiKey === apiKey) {
					return prevState
				}

				const newState = { ...prevState, openRouterImageApiKey: apiKey }

				// Check if any field differs from original
				let hasAnyChanges = false
				for (const key in newState) {
					if (key === "apiConfiguration") continue
					const cachedValue = newState[key as keyof ExtensionStateContextType]
					const originalValue = extensionState[key as keyof ExtensionStateContextType]
					if (hasChanged(cachedValue, originalValue)) {
						hasAnyChanges = true
						break
					}
				}

				// Check apiConfiguration
				if (!hasAnyChanges && newState.apiConfiguration && extensionState.apiConfiguration) {
					hasAnyChanges = hasChanged(newState.apiConfiguration, extensionState.apiConfiguration)
				}

				setChangeDetected(hasAnyChanges)
				return newState
			})
		},
		[extensionState],
	)

	const setImageGenerationSelectedModel = useCallback(
		(model: string) => {
			setCachedState((prevState) => {
				if (prevState.openRouterImageGenerationSelectedModel === model) {
					return prevState
				}

				const newState = { ...prevState, openRouterImageGenerationSelectedModel: model }

				// Check if any field differs from original
				let hasAnyChanges = false
				for (const key in newState) {
					if (key === "apiConfiguration") continue
					const cachedValue = newState[key as keyof ExtensionStateContextType]
					const originalValue = extensionState[key as keyof ExtensionStateContextType]
					if (hasChanged(cachedValue, originalValue)) {
						hasAnyChanges = true
						break
					}
				}

				// Check apiConfiguration
				if (!hasAnyChanges && newState.apiConfiguration && extensionState.apiConfiguration) {
					hasAnyChanges = hasChanged(newState.apiConfiguration, extensionState.apiConfiguration)
				}

				setChangeDetected(hasAnyChanges)
				return newState
			})
		},
		[extensionState],
	)

	const setCustomSupportPromptsField = useCallback(
		(prompts: Record<string, string | undefined>) => {
			setCachedState((prevState) => {
				if (JSON.stringify(prevState.customSupportPrompts) === JSON.stringify(prompts)) {
					return prevState
				}

				const newState = { ...prevState, customSupportPrompts: prompts }

				// Check if any field differs from original
				let hasAnyChanges = false
				for (const key in newState) {
					if (key === "apiConfiguration") continue
					const cachedValue = newState[key as keyof ExtensionStateContextType]
					const originalValue = extensionState[key as keyof ExtensionStateContextType]
					if (hasChanged(cachedValue, originalValue)) {
						hasAnyChanges = true
						break
					}
				}

				// Check apiConfiguration
				if (!hasAnyChanges && newState.apiConfiguration && extensionState.apiConfiguration) {
					hasAnyChanges = hasChanged(newState.apiConfiguration, extensionState.apiConfiguration)
				}

				setChangeDetected(hasAnyChanges)
				return newState
			})
		},
		[extensionState],
	)

	const isSettingValid = !errorMessage

	// Helper function to check if a value has changed
	const hasChanged = (cachedValue: any, originalValue: any): boolean => {
		// Handle objects and arrays with deep comparison
		if (typeof cachedValue === "object" && cachedValue !== null) {
			return JSON.stringify(cachedValue) !== JSON.stringify(originalValue)
		}
		return cachedValue !== originalValue
	}

	const handleSubmit = () => {
		if (isSettingValid) {
			// Only send messages for settings that have actually changed
			if (hasChanged(language, extensionState.language)) {
				vscode.postMessage({ type: "language", text: language })
			}
			if (hasChanged(alwaysAllowReadOnly, extensionState.alwaysAllowReadOnly)) {
				vscode.postMessage({ type: "alwaysAllowReadOnly", bool: alwaysAllowReadOnly })
			}
			if (hasChanged(alwaysAllowReadOnlyOutsideWorkspace, extensionState.alwaysAllowReadOnlyOutsideWorkspace)) {
				vscode.postMessage({
					type: "alwaysAllowReadOnlyOutsideWorkspace",
					bool: alwaysAllowReadOnlyOutsideWorkspace,
				})
			}
			if (hasChanged(alwaysAllowWrite, extensionState.alwaysAllowWrite)) {
				vscode.postMessage({ type: "alwaysAllowWrite", bool: alwaysAllowWrite })
			}
			if (hasChanged(alwaysAllowWriteOutsideWorkspace, extensionState.alwaysAllowWriteOutsideWorkspace)) {
				vscode.postMessage({ type: "alwaysAllowWriteOutsideWorkspace", bool: alwaysAllowWriteOutsideWorkspace })
			}
			if (hasChanged(alwaysAllowWriteProtected, extensionState.alwaysAllowWriteProtected)) {
				vscode.postMessage({ type: "alwaysAllowWriteProtected", bool: alwaysAllowWriteProtected })
			}
			if (hasChanged(alwaysAllowExecute, extensionState.alwaysAllowExecute)) {
				vscode.postMessage({ type: "alwaysAllowExecute", bool: alwaysAllowExecute })
			}
			if (hasChanged(alwaysAllowBrowser, extensionState.alwaysAllowBrowser)) {
				vscode.postMessage({ type: "alwaysAllowBrowser", bool: alwaysAllowBrowser })
			}
			if (hasChanged(alwaysAllowMcp, extensionState.alwaysAllowMcp)) {
				vscode.postMessage({ type: "alwaysAllowMcp", bool: alwaysAllowMcp })
			}
			if (hasChanged(allowedCommands, extensionState.allowedCommands)) {
				vscode.postMessage({ type: "allowedCommands", commands: allowedCommands ?? [] })
			}
			if (hasChanged(deniedCommands, extensionState.deniedCommands)) {
				vscode.postMessage({ type: "deniedCommands", commands: deniedCommands ?? [] })
			}
			if (hasChanged(allowedMaxRequests, extensionState.allowedMaxRequests)) {
				vscode.postMessage({ type: "allowedMaxRequests", value: allowedMaxRequests ?? undefined })
			}
			if (hasChanged(allowedMaxCost, extensionState.allowedMaxCost)) {
				vscode.postMessage({ type: "allowedMaxCost", value: allowedMaxCost ?? undefined })
			}

			// CRITICAL: Only send condense-related settings if they actually changed
			// This prevents unnecessary context condensing triggers during active tasks
			if (hasChanged(autoCondenseContext, extensionState.autoCondenseContext)) {
				vscode.postMessage({ type: "autoCondenseContext", bool: autoCondenseContext })
			}
			if (hasChanged(autoCondenseContextPercent, extensionState.autoCondenseContextPercent)) {
				vscode.postMessage({ type: "autoCondenseContextPercent", value: autoCondenseContextPercent })
			}
			if (hasChanged(profileThresholds, extensionState.profileThresholds)) {
				vscode.postMessage({ type: "profileThresholds", values: profileThresholds })
			}

			if (hasChanged(browserToolEnabled, extensionState.browserToolEnabled)) {
				vscode.postMessage({ type: "browserToolEnabled", bool: browserToolEnabled })
			}
			if (hasChanged(soundEnabled, extensionState.soundEnabled)) {
				vscode.postMessage({ type: "soundEnabled", bool: soundEnabled })
			}
			if (hasChanged(ttsEnabled, extensionState.ttsEnabled)) {
				vscode.postMessage({ type: "ttsEnabled", bool: ttsEnabled })
			}
			if (hasChanged(ttsSpeed, extensionState.ttsSpeed)) {
				vscode.postMessage({ type: "ttsSpeed", value: ttsSpeed })
			}
			if (hasChanged(soundVolume, extensionState.soundVolume)) {
				vscode.postMessage({ type: "soundVolume", value: soundVolume })
			}
			if (hasChanged(diffEnabled, extensionState.diffEnabled)) {
				vscode.postMessage({ type: "diffEnabled", bool: diffEnabled })
			}
			if (hasChanged(enableCheckpoints, extensionState.enableCheckpoints)) {
				vscode.postMessage({ type: "enableCheckpoints", bool: enableCheckpoints })
			}
			if (hasChanged(browserViewportSize, extensionState.browserViewportSize)) {
				vscode.postMessage({ type: "browserViewportSize", text: browserViewportSize })
			}
			if (hasChanged(remoteBrowserHost, extensionState.remoteBrowserHost)) {
				vscode.postMessage({ type: "remoteBrowserHost", text: remoteBrowserHost })
			}
			if (hasChanged(remoteBrowserEnabled, extensionState.remoteBrowserEnabled)) {
				vscode.postMessage({ type: "remoteBrowserEnabled", bool: remoteBrowserEnabled })
			}
			if (hasChanged(fuzzyMatchThreshold, extensionState.fuzzyMatchThreshold)) {
				vscode.postMessage({ type: "fuzzyMatchThreshold", value: fuzzyMatchThreshold ?? 1.0 })
			}
			if (hasChanged(writeDelayMs, extensionState.writeDelayMs)) {
				vscode.postMessage({ type: "writeDelayMs", value: writeDelayMs })
			}
			if (hasChanged(screenshotQuality, extensionState.screenshotQuality)) {
				vscode.postMessage({ type: "screenshotQuality", value: screenshotQuality ?? 75 })
			}
			if (hasChanged(terminalOutputLineLimit, extensionState.terminalOutputLineLimit)) {
				vscode.postMessage({ type: "terminalOutputLineLimit", value: terminalOutputLineLimit ?? 500 })
			}
			if (hasChanged(terminalOutputCharacterLimit, extensionState.terminalOutputCharacterLimit)) {
				vscode.postMessage({
					type: "terminalOutputCharacterLimit",
					value: terminalOutputCharacterLimit ?? 50000,
				})
			}
			if (hasChanged(terminalShellIntegrationTimeout, extensionState.terminalShellIntegrationTimeout)) {
				vscode.postMessage({ type: "terminalShellIntegrationTimeout", value: terminalShellIntegrationTimeout })
			}
			if (hasChanged(terminalShellIntegrationDisabled, extensionState.terminalShellIntegrationDisabled)) {
				vscode.postMessage({ type: "terminalShellIntegrationDisabled", bool: terminalShellIntegrationDisabled })
			}
			if (hasChanged(terminalCommandDelay, extensionState.terminalCommandDelay)) {
				vscode.postMessage({ type: "terminalCommandDelay", value: terminalCommandDelay })
			}
			if (hasChanged(terminalPowershellCounter, extensionState.terminalPowershellCounter)) {
				vscode.postMessage({ type: "terminalPowershellCounter", bool: terminalPowershellCounter })
			}
			if (hasChanged(terminalZshClearEolMark, extensionState.terminalZshClearEolMark)) {
				vscode.postMessage({ type: "terminalZshClearEolMark", bool: terminalZshClearEolMark })
			}
			if (hasChanged(terminalZshOhMy, extensionState.terminalZshOhMy)) {
				vscode.postMessage({ type: "terminalZshOhMy", bool: terminalZshOhMy })
			}
			if (hasChanged(terminalZshP10k, extensionState.terminalZshP10k)) {
				vscode.postMessage({ type: "terminalZshP10k", bool: terminalZshP10k })
			}
			if (hasChanged(terminalZdotdir, extensionState.terminalZdotdir)) {
				vscode.postMessage({ type: "terminalZdotdir", bool: terminalZdotdir })
			}
			if (hasChanged(terminalCompressProgressBar, extensionState.terminalCompressProgressBar)) {
				vscode.postMessage({ type: "terminalCompressProgressBar", bool: terminalCompressProgressBar })
			}
			if (hasChanged(mcpEnabled, extensionState.mcpEnabled)) {
				vscode.postMessage({ type: "mcpEnabled", bool: mcpEnabled })
			}
			if (hasChanged(alwaysApproveResubmit, extensionState.alwaysApproveResubmit)) {
				vscode.postMessage({ type: "alwaysApproveResubmit", bool: alwaysApproveResubmit })
			}
			if (hasChanged(requestDelaySeconds, extensionState.requestDelaySeconds)) {
				vscode.postMessage({ type: "requestDelaySeconds", value: requestDelaySeconds })
			}
			if (hasChanged(maxOpenTabsContext, extensionState.maxOpenTabsContext)) {
				vscode.postMessage({ type: "maxOpenTabsContext", value: maxOpenTabsContext })
			}
			if (hasChanged(maxWorkspaceFiles, extensionState.maxWorkspaceFiles)) {
				vscode.postMessage({ type: "maxWorkspaceFiles", value: maxWorkspaceFiles ?? 200 })
			}
			if (hasChanged(showRooIgnoredFiles, extensionState.showRooIgnoredFiles)) {
				vscode.postMessage({ type: "showRooIgnoredFiles", bool: showRooIgnoredFiles })
			}
			if (hasChanged(maxReadFileLine, extensionState.maxReadFileLine)) {
				vscode.postMessage({ type: "maxReadFileLine", value: maxReadFileLine ?? -1 })
			}
			if (hasChanged(maxImageFileSize, extensionState.maxImageFileSize)) {
				vscode.postMessage({ type: "maxImageFileSize", value: maxImageFileSize ?? 5 })
			}
			if (hasChanged(maxTotalImageSize, extensionState.maxTotalImageSize)) {
				vscode.postMessage({ type: "maxTotalImageSize", value: maxTotalImageSize ?? 20 })
			}
			if (hasChanged(maxConcurrentFileReads, extensionState.maxConcurrentFileReads)) {
				vscode.postMessage({ type: "maxConcurrentFileReads", value: cachedState.maxConcurrentFileReads ?? 5 })
			}
			if (hasChanged(includeDiagnosticMessages, extensionState.includeDiagnosticMessages)) {
				vscode.postMessage({ type: "includeDiagnosticMessages", bool: includeDiagnosticMessages })
			}
			if (hasChanged(maxDiagnosticMessages, extensionState.maxDiagnosticMessages)) {
				vscode.postMessage({ type: "maxDiagnosticMessages", value: maxDiagnosticMessages ?? 50 })
			}
			if (hasChanged(currentApiConfigName, extensionState.currentApiConfigName)) {
				vscode.postMessage({ type: "currentApiConfigName", text: currentApiConfigName })
			}
			if (hasChanged(experiments, extensionState.experiments)) {
				vscode.postMessage({ type: "updateExperimental", values: experiments })
			}
			if (hasChanged(alwaysAllowModeSwitch, extensionState.alwaysAllowModeSwitch)) {
				vscode.postMessage({ type: "alwaysAllowModeSwitch", bool: alwaysAllowModeSwitch })
			}
			if (hasChanged(alwaysAllowSubtasks, extensionState.alwaysAllowSubtasks)) {
				vscode.postMessage({ type: "alwaysAllowSubtasks", bool: alwaysAllowSubtasks })
			}
			if (hasChanged(alwaysAllowFollowupQuestions, extensionState.alwaysAllowFollowupQuestions)) {
				vscode.postMessage({ type: "alwaysAllowFollowupQuestions", bool: alwaysAllowFollowupQuestions })
			}
			if (hasChanged(alwaysAllowUpdateTodoList, extensionState.alwaysAllowUpdateTodoList)) {
				vscode.postMessage({ type: "alwaysAllowUpdateTodoList", bool: alwaysAllowUpdateTodoList })
			}
			if (hasChanged(followupAutoApproveTimeoutMs, extensionState.followupAutoApproveTimeoutMs)) {
				vscode.postMessage({ type: "followupAutoApproveTimeoutMs", value: followupAutoApproveTimeoutMs })
			}
			if (hasChanged(condensingApiConfigId, extensionState.condensingApiConfigId)) {
				vscode.postMessage({ type: "condensingApiConfigId", text: condensingApiConfigId || "" })
			}
			if (hasChanged(customCondensingPrompt, extensionState.customCondensingPrompt)) {
				vscode.postMessage({ type: "updateCondensingPrompt", text: customCondensingPrompt || "" })
			}
			if (hasChanged(customSupportPrompts, extensionState.customSupportPrompts)) {
				vscode.postMessage({ type: "updateSupportPrompt", values: customSupportPrompts || {} })
			}
			if (hasChanged(includeTaskHistoryInEnhance, extensionState.includeTaskHistoryInEnhance)) {
				vscode.postMessage({ type: "includeTaskHistoryInEnhance", bool: includeTaskHistoryInEnhance ?? true })
			}
			if (hasChanged(apiConfiguration, extensionState.apiConfiguration)) {
				vscode.postMessage({ type: "upsertApiConfiguration", text: currentApiConfigName, apiConfiguration })
			}
			if (hasChanged(telemetrySetting, extensionState.telemetrySetting)) {
				vscode.postMessage({ type: "telemetrySetting", text: telemetrySetting })
			}
			if (hasChanged(openRouterImageApiKey, extensionState.openRouterImageApiKey)) {
				vscode.postMessage({ type: "openRouterImageApiKey", text: openRouterImageApiKey })
			}
			if (
				hasChanged(
					openRouterImageGenerationSelectedModel,
					extensionState.openRouterImageGenerationSelectedModel,
				)
			) {
				vscode.postMessage({
					type: "openRouterImageGenerationSelectedModel",
					text: openRouterImageGenerationSelectedModel,
				})
			}
			setChangeDetected(false)
		}
	}

	const checkUnsaveChanges = useCallback(
		(then: () => void) => {
			if (isChangeDetected) {
				confirmDialogHandler.current = then
				setDiscardDialogShow(true)
			} else {
				then()
			}
		},
		[isChangeDetected],
	)

	useImperativeHandle(ref, () => ({ checkUnsaveChanges }), [checkUnsaveChanges])

	const onConfirmDialogResult = useCallback(
		(confirm: boolean) => {
			if (confirm) {
				// Discard changes: Reset state and flag
				setCachedState(extensionState) // Revert to original state
				setChangeDetected(false) // Reset change flag
				confirmDialogHandler.current?.() // Execute the pending action (e.g., tab switch)
			}
			// If confirm is false (Cancel), do nothing, dialog closes automatically
		},
		[extensionState], // Depend on extensionState to get the latest original state
	)

	// Handle tab changes with unsaved changes check
	const handleTabChange = useCallback(
		(newTab: SectionName) => {
			if (contentRef.current) {
				scrollPositions.current[activeTab] = contentRef.current.scrollTop
			}
			setActiveTab(newTab)
		},
		[activeTab],
	)

	useLayoutEffect(() => {
		if (contentRef.current) {
			contentRef.current.scrollTop = scrollPositions.current[activeTab] ?? 0
		}
	}, [activeTab])

	// Store direct DOM element refs for each tab
	const tabRefs = useRef<Record<SectionName, HTMLButtonElement | null>>(
		Object.fromEntries(sectionNames.map((name) => [name, null])) as Record<SectionName, HTMLButtonElement | null>,
	)

	// Track whether we're in compact mode
	const [isCompactMode, setIsCompactMode] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	// Setup resize observer to detect when we should switch to compact mode
	useEffect(() => {
		if (!containerRef.current) return

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				// If container width is less than 500px, switch to compact mode
				setIsCompactMode(entry.contentRect.width < 500)
			}
		})

		observer.observe(containerRef.current)

		return () => {
			observer?.disconnect()
		}
	}, [])

	const sections: { id: SectionName; icon: LucideIcon }[] = useMemo(
		() => [
			{ id: "providers", icon: Webhook },
			{ id: "autoApprove", icon: CheckCheck },
			{ id: "browser", icon: SquareMousePointer },
			{ id: "checkpoints", icon: GitBranch },
			{ id: "notifications", icon: Bell },
			{ id: "contextManagement", icon: Database },
			{ id: "terminal", icon: SquareTerminal },
			{ id: "prompts", icon: MessageSquare },
			{ id: "experimental", icon: FlaskConical },
			{ id: "language", icon: Globe },
			{ id: "about", icon: Info },
		],
		[], // No dependencies needed now
	)

	// Update target section logic to set active tab
	useEffect(() => {
		if (targetSection && sectionNames.includes(targetSection as SectionName)) {
			setActiveTab(targetSection as SectionName)
		}
	}, [targetSection])

	// Function to scroll the active tab into view for vertical layout
	const scrollToActiveTab = useCallback(() => {
		const activeTabElement = tabRefs.current[activeTab]

		if (activeTabElement) {
			activeTabElement.scrollIntoView({
				behavior: "auto",
				block: "nearest",
			})
		}
	}, [activeTab])

	// Effect to scroll when the active tab changes
	useEffect(() => {
		scrollToActiveTab()
	}, [activeTab, scrollToActiveTab])

	// Effect to scroll when the webview becomes visible
	useLayoutEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "action" && message.action === "didBecomeVisible") {
				scrollToActiveTab()
			}
		}

		window.addEventListener("message", handleMessage)

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [scrollToActiveTab])

	return (
		<Tab>
			<TabHeader className="flex justify-between items-center gap-2">
				<div className="flex items-center gap-1">
					<h3 className="text-vscode-foreground m-0">{t("settings:header.title")}</h3>
				</div>
				<div className="flex gap-2">
					<StandardTooltip
						content={
							!isSettingValid
								? errorMessage
								: isChangeDetected
									? t("settings:header.saveButtonTooltip")
									: t("settings:header.nothingChangedTooltip")
						}>
						<Button
							variant={isSettingValid ? "default" : "secondary"}
							className={!isSettingValid ? "!border-vscode-errorForeground" : ""}
							onClick={handleSubmit}
							disabled={!isChangeDetected || !isSettingValid}
							data-testid="save-button">
							{t("settings:common.save")}
						</Button>
					</StandardTooltip>
					<StandardTooltip content={t("settings:header.doneButtonTooltip")}>
						<Button variant="secondary" onClick={() => checkUnsaveChanges(onDone)}>
							{t("settings:common.done")}
						</Button>
					</StandardTooltip>
				</div>
			</TabHeader>

			{/* Vertical tabs layout */}
			<div ref={containerRef} className={cn(settingsTabsContainer, isCompactMode && "narrow")}>
				{/* Tab sidebar */}
				<TabList
					value={activeTab}
					onValueChange={(value) => handleTabChange(value as SectionName)}
					className={cn(settingsTabList)}
					data-compact={isCompactMode}
					data-testid="settings-tab-list">
					{sections.map(({ id, icon: Icon }) => {
						const isSelected = id === activeTab
						const onSelect = () => handleTabChange(id)

						// Base TabTrigger component definition
						// We pass isSelected manually for styling, but onSelect is handled conditionally
						const triggerComponent = (
							<TabTrigger
								ref={(element) => (tabRefs.current[id] = element)}
								value={id}
								isSelected={isSelected} // Pass manually for styling state
								className={cn(
									isSelected // Use manual isSelected for styling
										? `${settingsTabTrigger} ${settingsTabTriggerActive}`
										: settingsTabTrigger,
									"focus:ring-0", // Remove the focus ring styling
								)}
								data-testid={`tab-${id}`}
								data-compact={isCompactMode}>
								<div className={cn("flex items-center gap-2", isCompactMode && "justify-center")}>
									<Icon className="w-4 h-4" />
									<span className="tab-label">{t(`settings:sections.${id}`)}</span>
								</div>
							</TabTrigger>
						)

						if (isCompactMode) {
							// Wrap in Tooltip and manually add onClick to the trigger
							return (
								<TooltipProvider key={id} delayDuration={300}>
									<Tooltip>
										<TooltipTrigger asChild onClick={onSelect}>
											{/* Clone to avoid ref issues if triggerComponent itself had a key */}
											{React.cloneElement(triggerComponent)}
										</TooltipTrigger>
										<TooltipContent side="right" className="text-base">
											<p className="m-0">{t(`settings:sections.${id}`)}</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)
						} else {
							// Render trigger directly; TabList will inject onSelect via cloning
							// Ensure the element passed to TabList has the key
							return React.cloneElement(triggerComponent, { key: id })
						}
					})}
				</TabList>

				{/* Content area */}
				<TabContent ref={contentRef} className="p-0 flex-1 overflow-auto">
					{/* Providers Section */}
					{activeTab === "providers" && (
						<div>
							<SectionHeader>
								<div className="flex items-center gap-2">
									<Webhook className="w-4" />
									<div>{t("settings:sections.providers")}</div>
								</div>
							</SectionHeader>

							<Section>
								<ApiConfigManager
									currentApiConfigName={currentApiConfigName}
									listApiConfigMeta={listApiConfigMeta}
									onSelectConfig={(configName: string) =>
										checkUnsaveChanges(() =>
											vscode.postMessage({ type: "loadApiConfiguration", text: configName }),
										)
									}
									onDeleteConfig={(configName: string) =>
										vscode.postMessage({ type: "deleteApiConfiguration", text: configName })
									}
									onRenameConfig={(oldName: string, newName: string) => {
										vscode.postMessage({
											type: "renameApiConfiguration",
											values: { oldName, newName },
											apiConfiguration,
										})
										prevApiConfigName.current = newName
									}}
									onUpsertConfig={(configName: string) =>
										vscode.postMessage({
											type: "upsertApiConfiguration",
											text: configName,
											apiConfiguration,
										})
									}
								/>
								<ApiOptions
									uriScheme={uriScheme}
									apiConfiguration={apiConfiguration}
									setApiConfigurationField={setApiConfigurationField}
									errorMessage={errorMessage}
									setErrorMessage={setErrorMessage}
								/>
							</Section>
						</div>
					)}

					{/* Auto-Approve Section */}
					{activeTab === "autoApprove" && (
						<AutoApproveSettings
							alwaysAllowReadOnly={alwaysAllowReadOnly}
							alwaysAllowReadOnlyOutsideWorkspace={alwaysAllowReadOnlyOutsideWorkspace}
							alwaysAllowWrite={alwaysAllowWrite}
							alwaysAllowWriteOutsideWorkspace={alwaysAllowWriteOutsideWorkspace}
							alwaysAllowWriteProtected={alwaysAllowWriteProtected}
							alwaysAllowBrowser={alwaysAllowBrowser}
							alwaysApproveResubmit={alwaysApproveResubmit}
							requestDelaySeconds={requestDelaySeconds}
							alwaysAllowMcp={alwaysAllowMcp}
							alwaysAllowModeSwitch={alwaysAllowModeSwitch}
							alwaysAllowSubtasks={alwaysAllowSubtasks}
							alwaysAllowExecute={alwaysAllowExecute}
							alwaysAllowFollowupQuestions={alwaysAllowFollowupQuestions}
							alwaysAllowUpdateTodoList={alwaysAllowUpdateTodoList}
							followupAutoApproveTimeoutMs={followupAutoApproveTimeoutMs}
							allowedCommands={allowedCommands}
							allowedMaxRequests={allowedMaxRequests ?? undefined}
							allowedMaxCost={allowedMaxCost ?? undefined}
							deniedCommands={deniedCommands}
							setCachedStateField={setCachedStateField}
						/>
					)}

					{/* Browser Section */}
					{activeTab === "browser" && (
						<BrowserSettings
							browserToolEnabled={browserToolEnabled}
							browserViewportSize={browserViewportSize}
							screenshotQuality={screenshotQuality}
							remoteBrowserHost={remoteBrowserHost}
							remoteBrowserEnabled={remoteBrowserEnabled}
							setCachedStateField={setCachedStateField}
						/>
					)}

					{/* Checkpoints Section */}
					{activeTab === "checkpoints" && (
						<CheckpointSettings
							enableCheckpoints={enableCheckpoints}
							setCachedStateField={setCachedStateField}
						/>
					)}

					{/* Notifications Section */}
					{activeTab === "notifications" && (
						<NotificationSettings
							ttsEnabled={ttsEnabled}
							ttsSpeed={ttsSpeed}
							soundEnabled={soundEnabled}
							soundVolume={soundVolume}
							setCachedStateField={setCachedStateField}
						/>
					)}

					{/* Context Management Section */}
					{activeTab === "contextManagement" && (
						<ContextManagementSettings
							autoCondenseContext={autoCondenseContext}
							autoCondenseContextPercent={autoCondenseContextPercent}
							listApiConfigMeta={listApiConfigMeta ?? []}
							maxOpenTabsContext={maxOpenTabsContext}
							maxWorkspaceFiles={maxWorkspaceFiles ?? 200}
							showRooIgnoredFiles={showRooIgnoredFiles}
							maxReadFileLine={maxReadFileLine}
							maxImageFileSize={maxImageFileSize}
							maxTotalImageSize={maxTotalImageSize}
							maxConcurrentFileReads={maxConcurrentFileReads}
							profileThresholds={profileThresholds}
							includeDiagnosticMessages={includeDiagnosticMessages}
							maxDiagnosticMessages={maxDiagnosticMessages}
							writeDelayMs={writeDelayMs}
							setCachedStateField={setCachedStateField}
						/>
					)}

					{/* Terminal Section */}
					{activeTab === "terminal" && (
						<TerminalSettings
							terminalOutputLineLimit={terminalOutputLineLimit}
							terminalOutputCharacterLimit={terminalOutputCharacterLimit}
							terminalShellIntegrationTimeout={terminalShellIntegrationTimeout}
							terminalShellIntegrationDisabled={terminalShellIntegrationDisabled}
							terminalCommandDelay={terminalCommandDelay}
							terminalPowershellCounter={terminalPowershellCounter}
							terminalZshClearEolMark={terminalZshClearEolMark}
							terminalZshOhMy={terminalZshOhMy}
							terminalZshP10k={terminalZshP10k}
							terminalZdotdir={terminalZdotdir}
							terminalCompressProgressBar={terminalCompressProgressBar}
							setCachedStateField={setCachedStateField}
						/>
					)}

					{/* Prompts Section */}
					{activeTab === "prompts" && (
						<PromptsSettings
							customSupportPrompts={customSupportPrompts || {}}
							setCustomSupportPrompts={setCustomSupportPromptsField}
							includeTaskHistoryInEnhance={includeTaskHistoryInEnhance}
							setIncludeTaskHistoryInEnhance={(value) =>
								setCachedStateField("includeTaskHistoryInEnhance", value)
							}
						/>
					)}

					{/* Experimental Section */}
					{activeTab === "experimental" && (
						<ExperimentalSettings
							setExperimentEnabled={setExperimentEnabled}
							experiments={experiments}
							apiConfiguration={apiConfiguration}
							setApiConfigurationField={setApiConfigurationField}
							openRouterImageApiKey={openRouterImageApiKey as string | undefined}
							openRouterImageGenerationSelectedModel={
								openRouterImageGenerationSelectedModel as string | undefined
							}
							setOpenRouterImageApiKey={setOpenRouterImageApiKey}
							setImageGenerationSelectedModel={setImageGenerationSelectedModel}
						/>
					)}

					{/* Language Section */}
					{activeTab === "language" && (
						<LanguageSettings language={language || "en"} setCachedStateField={setCachedStateField} />
					)}

					{/* About Section */}
					{activeTab === "about" && (
						<About telemetrySetting={telemetrySetting} setTelemetrySetting={setTelemetrySetting} />
					)}
				</TabContent>
			</div>

			<AlertDialog open={isDiscardDialogShow} onOpenChange={setDiscardDialogShow}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							<AlertTriangle className="w-5 h-5 text-yellow-500" />
							{t("settings:unsavedChangesDialog.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("settings:unsavedChangesDialog.description")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => onConfirmDialogResult(false)}>
							{t("settings:unsavedChangesDialog.cancelButton")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={() => onConfirmDialogResult(true)}>
							{t("settings:unsavedChangesDialog.discardButton")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Tab>
	)
})

export default memo(SettingsView)
