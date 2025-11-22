import React, { useCallback, useEffect, useRef, useState, useMemo } from "react"
import { useEvent } from "react-use"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
// import posthog from "posthog-js"

import { ExtensionMessage } from "@roo/ExtensionMessage"
import TranslationProvider from "./i18n/TranslationContext"
// import { MarketplaceViewStateManager } from "./components/marketplace/MarketplaceViewStateManager"

import { vscode } from "./utils/vscode"
import { telemetryClient } from "./utils/TelemetryClient"
import { TelemetryEventName } from "@roo-code/types"
import { initializeSourceMaps, exposeSourceMapsForDebugging } from "./utils/sourceMapInitializer"
import { ExtensionStateContextProvider, useExtensionState } from "./context/ExtensionStateContext"
import ChatView, { ChatViewRef } from "./components/chat/ChatView"
import HistoryView from "./components/history/HistoryView"
import SettingsView, { SettingsViewRef } from "./components/settings/SettingsView"
import WelcomeView from "./components/welcome/WelcomeView"
// import WelcomeViewProvider from "./components/welcome/WelcomeViewProvider"
import McpView from "./components/mcp/McpView"
// import { MarketplaceView } from "./components/marketplace/MarketplaceView"
import ModesView from "./components/modes/ModesView"
import CodeReviewPage from "./components/code-review"
import { HumanRelayDialog } from "./components/human-relay/HumanRelayDialog"
import { CheckpointRestoreDialog } from "./components/chat/CheckpointRestoreDialog"
import { DeleteMessageDialog, EditMessageDialog } from "./components/chat/MessageModificationConfirmationDialog"
import ErrorBoundary from "./components/ErrorBoundary"
// import { CloudView } from "./components/cloud/CloudView"
import { useAddNonInteractiveClickListener } from "./components/ui/hooks/useNonInteractiveClick"
import { TooltipProvider } from "./components/ui/tooltip"
import { STANDARD_TOOLTIP_DELAY, StandardTooltip } from "./components/ui/standard-tooltip"
import { ZgsmAccountView } from "./components/cloud/ZgsmAccountView"
import { TabContent, TabList, TabTrigger } from "./components/common/Tab"
import { cn } from "./lib/utils"
import { ReauthConfirmationDialog } from "./components/chat/ReauthConfirmationDialog"
import { ZgsmCodebaseDisableConfirmDialog } from "./components/settings/ZgsmCodebaseDisableConfirmDialog"
import { useTranslation } from "react-i18next"

type Tab = "settings" | "history" | "mcp" | "modes" | "chat" | "marketplace" | "cloud" | "zgsm-account" | "codeReview"

interface HumanRelayDialogState {
	isOpen: boolean
	requestId: string
	promptText: string
}

interface ReauthConfirmationDialogState {
	isOpen: boolean
	messageTs: number
}

interface DeleteMessageDialogState {
	isOpen: boolean
	messageTs: number
	hasCheckpoint: boolean
}

interface EditMessageDialogState {
	isOpen: boolean
	messageTs: number
	text: string
	hasCheckpoint: boolean
	images?: string[]
}

interface ZgsmCodebaseDisableConfirmDialogState {
	isOpen: boolean
}

// Memoize dialog components to prevent unnecessary re-renders
const MemoizedDeleteMessageDialog = React.memo(DeleteMessageDialog)
const MemoizedEditMessageDialog = React.memo(EditMessageDialog)
const MemoizedReauthConfirmationDialog = React.memo(ReauthConfirmationDialog)
const MemoizedCheckpointRestoreDialog = React.memo(CheckpointRestoreDialog)
const MemoizedHumanRelayDialog = React.memo(HumanRelayDialog)
const MemoizedZgsmCodebaseDisableConfirmDialog = React.memo(ZgsmCodebaseDisableConfirmDialog)

const tabsByMessageAction: Partial<Record<NonNullable<ExtensionMessage["action"]>, Tab>> = {
	chatButtonClicked: "chat",
	settingsButtonClicked: "settings",
	promptsButtonClicked: "modes",
	mcpButtonClicked: "mcp",
	historyButtonClicked: "history",
	// marketplaceButtonClicked: "marketplace",
	cloudButtonClicked: "cloud",
	zgsmAccountButtonClicked: "zgsm-account",
	codeReviewButtonClicked: "codeReview",
}

const App = () => {
	const {
		didHydrateState,
		showWelcome,
		// shouldShowAnnouncement,
		telemetrySetting,
		telemetryKey,
		machineId,
		// cloudUserInfo,
		// cloudIsAuthenticated,
		// cloudApiUrl,
		// cloudOrganizations,
		renderContext,
		mdmCompliant,
		apiConfiguration,
	} = useExtensionState()
	const { t } = useTranslation()

	// const [useProviderSignupView, setUseProviderSignupView] = useState(false)

	// // Check PostHog feature flag for provider signup view
	// // Wait for telemetry to be initialized before checking feature flags
	// useEffect(() => {
	// 	if (!didHydrateState || telemetrySetting === "disabled") {
	// 		return
	// 	}

	// 	posthog.onFeatureFlags(function () {
	// 		// Feature flag for new provider-focused welcome view
	// 		setUseProviderSignupView(posthog?.getFeatureFlag("welcome-provider-signup") === "test")
	// 	})
	// }, [didHydrateState, telemetrySetting])

	// Create a persistent state manager
	// const marketplaceStateManager = useMemo(() => new MarketplaceViewStateManager(), [])

	const [showAnnouncement, setShowAnnouncement] = useState(false)
	const [tab, setTab] = useState<Tab>("chat")
	const isChatTab = useMemo(() => ["chat", "codeReview"].includes(tab), [tab])

	const [humanRelayDialogState, setHumanRelayDialogState] = useState<HumanRelayDialogState>({
		isOpen: false,
		requestId: "",
		promptText: "",
	})

	const [deleteMessageDialogState, setDeleteMessageDialogState] = useState<DeleteMessageDialogState>({
		isOpen: false,
		messageTs: 0,
		hasCheckpoint: false,
	})

	const [reauthConfirmationDialogState, setReauthConfirmationDialogState] = useState<ReauthConfirmationDialogState>({
		isOpen: false,
		messageTs: 0,
	})

	const [editMessageDialogState, setEditMessageDialogState] = useState<EditMessageDialogState>({
		isOpen: false,
		messageTs: 0,
		text: "",
		hasCheckpoint: false,
		images: [],
	})

	const [zgsmCodebaseDisableConfirmDialogState, setZgsmCodebaseDisableConfirmDialogState] =
		useState<ZgsmCodebaseDisableConfirmDialogState>({
			isOpen: false,
		})

	const settingsRef = useRef<SettingsViewRef>(null)
	const chatViewRef = useRef<ChatViewRef>(null)

	const switchTab = useCallback(
		(newTab: Tab) => {
			// Only check MDM compliance if mdmCompliant is explicitly false (meaning there's an MDM policy and user is non-compliant)
			// If mdmCompliant is undefined or true, allow tab switching
			if (mdmCompliant === false && newTab !== "cloud" && newTab !== "zgsm-account") {
				// Notify the user that authentication is required by their organization
				// vscode.postMessage({ type: "showMdmAuthRequiredNotification" })
				return
			}

			setCurrentSection(undefined)
			setCurrentMarketplaceTab(undefined)

			if (settingsRef.current?.checkUnsaveChanges) {
				settingsRef.current.checkUnsaveChanges(() => setTab(newTab))
			} else {
				setTab(newTab)
			}
		},
		[mdmCompliant],
	)

	const [currentSection, setCurrentSection] = useState<string | undefined>(undefined)
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [currentMarketplaceTab, setCurrentMarketplaceTab] = useState<string | undefined>(undefined)

	const onMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data

			if (message.type === "action" && message.action) {
				// Handle switchTab action with tab parameter
				if (message.action === "switchTab" && message.tab) {
					const targetTab = message.tab as Tab
					switchTab(targetTab)
					// Extract targetSection from values if provided
					const targetSection = message.values?.section as string | undefined
					setCurrentSection(targetSection)
					setCurrentMarketplaceTab(undefined)
				} else {
					// Handle other actions using the mapping
					const newTab =
						tabsByMessageAction[
							message.action === "cloudButtonClicked" ? "zgsmAccountButtonClicked" : message.action
						]
					const section = message.values?.section as string | undefined
					const marketplaceTab = message.values?.marketplaceTab as string | undefined

					if (newTab) {
						switchTab(newTab)
						setCurrentSection(section)
						setCurrentMarketplaceTab(marketplaceTab)
					}
				}
			}

			if (message.type === "showHumanRelayDialog" && message.requestId && message.promptText) {
				const { requestId, promptText } = message
				setHumanRelayDialogState({ isOpen: true, requestId, promptText })
			}

			if (message.type === "showReauthConfirmationDialog" && message.messageTs) {
				setReauthConfirmationDialogState({ isOpen: true, messageTs: message.messageTs })
			}

			if (message.type === "showDeleteMessageDialog" && message.messageTs) {
				setDeleteMessageDialogState({
					isOpen: true,
					messageTs: message.messageTs,
					hasCheckpoint: message.hasCheckpoint || false,
				})
			}

			if (message.type === "showEditMessageDialog" && message.messageTs && message.text) {
				setEditMessageDialogState({
					isOpen: true,
					messageTs: message.messageTs,
					text: message.text,
					hasCheckpoint: message.hasCheckpoint || false,
					images: message.images || [],
				})
			}

			if (message.type === "showZgsmCodebaseDisableConfirmDialog") {
				setZgsmCodebaseDisableConfirmDialogState({ isOpen: true })
			}

			if (message.type === "acceptInput") {
				chatViewRef.current?.acceptInput()
			}
		},
		[switchTab],
	)

	useEvent("message", onMessage)

	// useEffect(() => {
	// 	if (shouldShowAnnouncement && tab === "chat") {
	// 		setShowAnnouncement(true)
	// 		vscode.postMessage({ type: "didShowAnnouncement" })
	// 	}
	// }, [shouldShowAnnouncement, tab])

	useEffect(() => {
		if (didHydrateState) {
			telemetryClient.updateTelemetryState(telemetrySetting, telemetryKey, machineId)
		}
	}, [telemetrySetting, telemetryKey, machineId, didHydrateState])

	// Tell the extension that we are ready to receive messages.
	useEffect(() => vscode.postMessage({ type: "webviewDidLaunch" }), [])

	// Initialize source map support for better error reporting
	useEffect(() => {
		// Initialize source maps for better error reporting in production
		initializeSourceMaps()

		// Expose source map debugging utilities in production
		if (process.env.NODE_ENV === "production") {
			exposeSourceMapsForDebugging()
		}

		// Log initialization for debugging
		console.debug("App initialized with source map support")
	}, [])

	// Focus the WebView when non-interactive content is clicked (only in editor/tab mode)
	useAddNonInteractiveClickListener(
		useCallback(() => {
			// Only send focus request if we're in editor (tab) mode, not sidebar
			if (renderContext === "editor") {
				vscode.postMessage({ type: "focusPanelRequest" })
			}
		}, [renderContext]),
	)
	// Track marketplace tab views
	useEffect(() => {
		if (tab === "marketplace") {
			telemetryClient.capture(TelemetryEventName.MARKETPLACE_TAB_VIEWED)
		}
	}, [tab])

	const tabs = useMemo(() => {
		const baseTabs = [
			{
				label: "AGENT",
				value: "chat",
			},
		]

		if (apiConfiguration?.apiProvider === "zgsm") {
			baseTabs.push({
				label: "CODE REVIEW",
				value: "codeReview",
			})
		}

		return baseTabs
	}, [apiConfiguration?.apiProvider])

	const resetTabs = useCallback(() => {
		setTab("chat")
		vscode.postMessage({ type: "clearTask" })
	}, [setTab])

	const onIssueClick = useCallback((issueId: string) => {
		vscode.postMessage({ type: "checkReviewSuggestion", issueId })
	}, [])
	const onTaskCancel = useCallback(() => {
		vscode.postMessage({ type: "cancelReviewTask" })
	}, [])

	if (!didHydrateState) {
		return null
	}

	// Do not conditionally load ChatView, it's expensive and there's state we
	// don't want to lose (user input, disableInput, askResponse promise, etc.)
	return showWelcome ? (
		<WelcomeView />
	) : (
		<>
			{tab === "modes" && <ModesView onDone={() => switchTab("chat")} />}
			{tab === "mcp" && <McpView onDone={() => switchTab("chat")} />}
			{tab === "history" && <HistoryView onDone={() => switchTab("chat")} />}
			{tab === "settings" && (
				<SettingsView ref={settingsRef} onDone={() => setTab("chat")} targetSection={currentSection} />
			)}
			{/* {tab === "marketplace" && (
				<MarketplaceView
					stateManager={marketplaceStateManager}
					onDone={() => switchTab("chat")}
					targetTab={currentMarketplaceTab as "mcp" | "mode" | undefined}
				/>
			)} */}
			{/* {tab === "cloud" && (
				<CloudView
					userInfo={cloudUserInfo}
					isAuthenticated={cloudIsAuthenticated}
					cloudApiUrl={cloudApiUrl}
					organizations={cloudOrganizations}
					onDone={() => switchTab("chat")}
				/>
			)} */}
			{tab === "zgsm-account" && (
				<ZgsmAccountView apiConfiguration={apiConfiguration} onDone={() => switchTab("chat")} />
			)}
			<div className={`${isChatTab ? "fixed inset-0 flex flex-col" : "hidden"}`}>
				<div className={`header flex items-center justify-between px-5 ${isChatTab ? "" : "hidden"}`}>
					<TabList value={tab} onValueChange={(val) => switchTab(val as Tab)} className="header-left h-7">
						{tabs.map(({ label, value }) => {
							const isSelected = tab === value
							const activeTabClass = isSelected ? "border-b border-gray-200" : ""

							return (
								<TabTrigger
									key={value}
									value={value}
									isSelected={isSelected}
									className={cn(activeTabClass, "mr-4", "cursor-pointer")}
									focusNeedRing={false}>
									{label}
								</TabTrigger>
							)
						})}
					</TabList>

					{tab === "chat" && (
						<div className="header-right flex absolute right-3">
							<StandardTooltip content={t("chat:startNewTask.title")}>
								<i
									className="codicon codicon-add mr-1 cursor-pointer p-0.5"
									onClick={() => resetTabs()}></i>
							</StandardTooltip>
							<StandardTooltip content={t("history:history")}>
								<i
									className="codicon codicon-history cursor-pointer p-0.5"
									onClick={() => switchTab("history")}></i>
							</StandardTooltip>
						</div>
					)}
				</div>
				<TabContent>
					<ChatView
						ref={chatViewRef}
						isHidden={tab !== "chat"}
						showAnnouncement={showAnnouncement}
						hideAnnouncement={() => setShowAnnouncement(false)}
					/>
					{tab === "codeReview" && (
						<CodeReviewPage
							isHidden={tab !== "codeReview"}
							onIssueClick={onIssueClick}
							onTaskCancel={onTaskCancel}
						/>
					)}
				</TabContent>
			</div>
			<MemoizedHumanRelayDialog
				isOpen={humanRelayDialogState.isOpen}
				requestId={humanRelayDialogState.requestId}
				promptText={humanRelayDialogState.promptText}
				onClose={() => setHumanRelayDialogState((prev) => ({ ...prev, isOpen: false }))}
				onSubmit={(requestId, text) => vscode.postMessage({ type: "humanRelayResponse", requestId, text })}
				onCancel={(requestId) => vscode.postMessage({ type: "humanRelayCancel", requestId })}
			/>
			{deleteMessageDialogState.hasCheckpoint ? (
				<MemoizedCheckpointRestoreDialog
					open={deleteMessageDialogState.isOpen}
					type="delete"
					hasCheckpoint={deleteMessageDialogState.hasCheckpoint}
					onOpenChange={(open: boolean) => setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={(restoreCheckpoint: boolean) => {
						vscode.postMessage({
							type: "deleteMessageConfirm",
							messageTs: deleteMessageDialogState.messageTs,
							restoreCheckpoint,
						})
						setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			) : (
				<MemoizedDeleteMessageDialog
					open={deleteMessageDialogState.isOpen}
					onOpenChange={(open: boolean) => setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={() => {
						vscode.postMessage({
							type: "deleteMessageConfirm",
							messageTs: deleteMessageDialogState.messageTs,
						})
						setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			)}
			{editMessageDialogState.hasCheckpoint ? (
				<MemoizedCheckpointRestoreDialog
					open={editMessageDialogState.isOpen}
					type="edit"
					hasCheckpoint={editMessageDialogState.hasCheckpoint}
					onOpenChange={(open: boolean) => setEditMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={(restoreCheckpoint: boolean) => {
						vscode.postMessage({
							type: "editMessageConfirm",
							messageTs: editMessageDialogState.messageTs,
							text: editMessageDialogState.text,
							restoreCheckpoint,
						})
						setEditMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			) : (
				<MemoizedEditMessageDialog
					open={editMessageDialogState.isOpen}
					onOpenChange={(open: boolean) => setEditMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
					onConfirm={() => {
						vscode.postMessage({
							type: "editMessageConfirm",
							messageTs: editMessageDialogState.messageTs,
							text: editMessageDialogState.text,
							images: editMessageDialogState.images,
						})
						setEditMessageDialogState((prev) => ({ ...prev, isOpen: false }))
					}}
				/>
			)}
			<MemoizedReauthConfirmationDialog
				open={reauthConfirmationDialogState.isOpen}
				onOpenChange={(open) => setReauthConfirmationDialogState((prev) => ({ ...prev, isOpen: open }))}
				onConfirm={() => {
					vscode.postMessage({ type: "zgsmLogin", apiConfiguration })
					setReauthConfirmationDialogState((prev) => ({ ...prev, isOpen: false }))
				}}
			/>
			<MemoizedZgsmCodebaseDisableConfirmDialog
				open={zgsmCodebaseDisableConfirmDialogState.isOpen}
				onOpenChange={(open) => setZgsmCodebaseDisableConfirmDialogState((prev) => ({ ...prev, isOpen: open }))}
				onConfirm={() => {
					vscode.postMessage({ type: "zgsmCodebaseIndexEnabled", bool: false })
					setZgsmCodebaseDisableConfirmDialogState((prev) => ({ ...prev, isOpen: false }))
				}}
			/>
		</>
	)
}

const queryClient = new QueryClient()

const AppWithProviders = () => (
	<ErrorBoundary>
		<ExtensionStateContextProvider>
			<TranslationProvider>
				<QueryClientProvider client={queryClient}>
					<TooltipProvider delayDuration={STANDARD_TOOLTIP_DELAY}>
						<App />
					</TooltipProvider>
				</QueryClientProvider>
			</TranslationProvider>
		</ExtensionStateContextProvider>
	</ErrorBoundary>
)

export default AppWithProviders
