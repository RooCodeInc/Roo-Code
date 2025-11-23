import type {
	GlobalSettings,
	ProviderSettingsEntry,
	ProviderSettings,
	HistoryItem,
	ModeConfig,
	TelemetrySetting,
	Experiments,
	ClineMessage,
	ModelInfo,
	MarketplaceItem,
	TodoItem,
	CloudUserInfo,
	CloudOrganizationMembership,
	OrganizationAllowList,
	ShareVisibility,
	QueuedMessage,
	IZgsmModelResponseData,
} from "@roo-code/types"

import { GitCommit } from "../utils/git"

import { McpServer } from "./mcp"
import { Mode } from "./modes"
import { ModelRecord, RouterModels } from "./api"
import { INotice } from "../core/costrict/notification/notificationService"

// Command interface for frontend/backend communication
export interface Command {
	name: string
	source: "global" | "project" | "built-in"
	filePath?: string
	description?: string
	argumentHint?: string
}

// Type for marketplace installed metadata
export interface MarketplaceInstalledMetadata {
	project: Record<string, { type: string }>
	global: Record<string, { type: string }>
}

// Indexing status types
export interface IndexingStatus {
	systemStatus: string
	message?: string
	processedItems: number
	totalItems: number
	currentItemUnit?: string
	workspacePath?: string
}

export interface IndexingStatusUpdateMessage {
	type: "indexingStatusUpdate"
	values: IndexingStatus
}

export interface LanguageModelChatSelector {
	vendor?: string
	family?: string
	version?: string
	id?: string
}

// Represents JSON data that is sent from extension to webview, called
// ExtensionMessage and has 'type' enum which can be 'plusButtonClicked' or
// 'settingsButtonClicked' or 'hello'. Webview will hold state.
export interface ExtensionMessage {
	type:
		| "action"
		| "state"
		| "selectedImages"
		| "theme"
		| "workspaceUpdated"
		| "invoke"
		| "messageUpdated"
		| "mcpServers"
		| "enhancedPrompt"
		| "commitSearchResults"
		| "listApiConfig"
		| "routerModels"
		| "openAiModels"
		// zgsm
		| "zgsmModels"
		| "zgsmLogined"
		| "showReauthConfirmationDialog"
		| "zgsmCodebaseIndexEnabled"
		| "zgsmQuotaInfo"
		| "zgsmInviteCode"
		| "zgsmNotices"
		| "settingsUpdated"
		| "zgsmFollowupClearTimeout"
		// zgsm
		| "ollamaModels"
		| "lmStudioModels"
		| "vsCodeLmModels"
		| "huggingFaceModels"
		| "vsCodeLmApiAvailable"
		| "updatePrompt"
		| "systemPrompt"
		| "autoApprovalEnabled"
		| "updateCustomMode"
		| "deleteCustomMode"
		| "exportModeResult"
		| "importModeResult"
		| "checkRulesDirectoryResult"
		| "deleteCustomModeCheck"
		| "currentCheckpointUpdated"
		| "checkpointInitWarning"
		| "showHumanRelayDialog"
		| "humanRelayResponse"
		| "humanRelayCancel"
		| "browserToolEnabled"
		| "browserConnectionResult"
		| "remoteBrowserEnabled"
		| "ttsStart"
		| "ttsStop"
		| "maxReadFileLine"
		| "fileSearchResults"
		| "toggleApiConfigPin"
		| "acceptInput"
		| "setHistoryPreviewCollapsed"
		| "commandExecutionStatus"
		| "mcpExecutionStatus"
		| "vsCodeSetting"
		| "authenticatedUser"
		| "condenseTaskContextResponse"
		| "singleRouterModelFetchResponse"
		| "rooCreditBalance"
		| "indexingStatusUpdate"
		| "indexCleared"
		| "codebaseIndexConfig"
		| "marketplaceInstallResult"
		| "marketplaceRemoveResult"
		| "marketplaceData"
		| "shareTaskSuccess"
		| "codeIndexSettingsSaved"
		| "codeIndexSecretStatus"
		| "codebaseIndexStatusResponse"
		| "showDeleteMessageDialog"
		| "showEditMessageDialog"
		| "showZgsmCodebaseDisableConfirmDialog"
		| "reviewTaskUpdate"
		| "issueStatusUpdated"
		| "commands"
		| "insertTextIntoTextarea"
		| "reviewPagePayload"
		| "dismissedUpsells"
		| "organizationSwitchResult"
		| "interactionRequired"
		| "browserSessionUpdate"
		| "browserSessionNavigate"
	text?: string
	payload?: any // Add a generic payload for now, can refine later
	// Checkpoint warning message
	checkpointWarning?: {
		type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"
		timeout: number
	}
	action?:
		| "chatButtonClicked"
		| "mcpButtonClicked"
		| "settingsButtonClicked"
		| "openCreateModeDialog"
		| "historyButtonClicked"
		| "promptsButtonClicked"
		| "marketplaceButtonClicked"
		| "cloudButtonClicked"
		| "zgsmAccountButtonClicked"
		| "didBecomeVisible"
		| "focusInput"
		| "switchTab"
		| "toggleAutoApprove"
		| "codeReviewButtonClicked"
	invoke?:
		| "newChat"
		| "sendMessage"
		| "primaryButtonClick"
		| "secondaryButtonClick"
		| "setChatBoxMessage"
		| "setChatBoxMessageByContext"
	state?: ExtensionState
	images?: string[]
	filePaths?: string[]
	openedTabs?: Array<{
		label: string
		isActive: boolean
		path?: string
	}>
	clineMessage?: ClineMessage
	routerModels?: RouterModels
	openAiModels?: string[]
	ollamaModels?: ModelRecord
	lmStudioModels?: ModelRecord
	fullResponseData?: IZgsmModelResponseData[]
	vsCodeLmModels?: { vendor?: string; family?: string; version?: string; id?: string }[]
	huggingFaceModels?: Array<{
		id: string
		object: string
		created: number
		owned_by: string
		providers: Array<{
			provider: string
			status: "live" | "staging" | "error"
			supports_tools?: boolean
			supports_structured_output?: boolean
			context_length?: number
			pricing?: {
				input: number
				output: number
			}
		}>
	}>
	mcpServers?: McpServer[]
	commits?: GitCommit[]
	listApiConfig?: ProviderSettingsEntry[]
	mode?: Mode
	customMode?: ModeConfig
	slug?: string
	success?: boolean
	values?: Record<string, any>
	requestId?: string
	promptText?: string
	results?: { path: string; type: "file" | "folder"; label?: string }[]
	error?: string
	setting?: string
	value?: any
	hasContent?: boolean // For checkRulesDirectoryResult
	items?: MarketplaceItem[]
	userInfo?: CloudUserInfo
	organizationAllowList?: OrganizationAllowList
	tab?: string
	marketplaceItems?: MarketplaceItem[]
	organizationMcps?: MarketplaceItem[]
	marketplaceInstalledMetadata?: MarketplaceInstalledMetadata
	errors?: string[]
	visibility?: ShareVisibility
	rulesFolderPath?: string
	settings?: any
	messageTs?: number
	hasCheckpoint?: boolean
	context?: string
	commands?: Command[]
	selectText?: string
	queuedMessages?: QueuedMessage[]
	list?: string[] // For dismissedUpsells
	organizationId?: string | null // For organizationSwitchResult
	notices?: Array<INotice> // For zgsmNotices, only "always" type notices
	browserSessionMessages?: ClineMessage[] // For browser session panel updates
	isBrowserSessionActive?: boolean // For browser session panel updates
	stepIndex?: number // For browserSessionNavigate: the target step index to display
}

export type ExtensionState = Pick<
	GlobalSettings,
	| "currentApiConfigName"
	| "useZgsmCustomConfig"
	| "zgsmCodebaseIndexEnabled"
	| "listApiConfigMeta"
	| "pinnedApiConfigs"
	| "customInstructions"
	| "dismissedUpsells"
	| "autoApprovalEnabled"
	| "alwaysAllowReadOnly"
	| "alwaysAllowReadOnlyOutsideWorkspace"
	| "alwaysAllowWrite"
	| "alwaysAllowWriteOutsideWorkspace"
	| "alwaysAllowWriteProtected"
	| "alwaysAllowBrowser"
	| "alwaysApproveResubmit"
	| "alwaysAllowMcp"
	| "alwaysAllowModeSwitch"
	| "alwaysAllowSubtasks"
	| "alwaysAllowFollowupQuestions"
	| "alwaysAllowExecute"
	| "alwaysAllowUpdateTodoList"
	| "followupAutoApproveTimeoutMs"
	| "allowedCommands"
	| "deniedCommands"
	| "allowedMaxRequests"
	| "allowedMaxCost"
	| "browserToolEnabled"
	| "browserViewportSize"
	| "screenshotQuality"
	| "remoteBrowserEnabled"
	| "cachedChromeHostUrl"
	| "remoteBrowserHost"
	| "ttsEnabled"
	| "ttsSpeed"
	| "soundEnabled"
	| "soundVolume"
	| "maxConcurrentFileReads"
	| "terminalOutputLineLimit"
	| "terminalOutputCharacterLimit"
	| "maxReadCharacterLimit"
	| "terminalShellIntegrationTimeout"
	| "terminalShellIntegrationDisabled"
	| "terminalCommandDelay"
	| "terminalPowershellCounter"
	| "terminalZshClearEolMark"
	| "terminalZshOhMy"
	| "terminalZshP10k"
	| "terminalZdotdir"
	| "terminalCompressProgressBar"
	| "diagnosticsEnabled"
	| "diffEnabled"
	| "fuzzyMatchThreshold"
	| "language"
	| "modeApiConfigs"
	| "customModePrompts"
	| "customSupportPrompts"
	| "enhancementApiConfigId"
	| "condensingApiConfigId"
	| "customCondensingPrompt"
	| "codebaseIndexConfig"
	| "codebaseIndexModels"
	| "profileThresholds"
	| "includeDiagnosticMessages"
	| "maxDiagnosticMessages"
	| "openRouterImageGenerationSelectedModel"
	| "includeTaskHistoryInEnhance"
	| "reasoningBlockCollapsed"
	| "apiRequestBlockHide"
	| "errorCode"
	| "includeCurrentTime"
	| "includeCurrentCost"
	| "maxGitStatusFiles"
> & {
	version: string
	clineMessages: ClineMessage[]
	currentTaskItem?: HistoryItem
	currentTaskTodos?: TodoItem[] // Initial todos for the current task
	apiConfiguration: ProviderSettings
	uriScheme?: string
	shouldShowAnnouncement: boolean

	taskHistory: HistoryItem[]

	writeDelayMs: number
	requestDelaySeconds: number

	enableCheckpoints: boolean
	checkpointTimeout: number // Timeout for checkpoint initialization in seconds (default: 15)
	maxOpenTabsContext: number // Maximum number of VSCode open tabs to include in context (0-500)
	maxWorkspaceFiles: number // Maximum number of files to include in current working directory details (0-500)
	showRooIgnoredFiles: boolean // Whether to show .rooignore'd files in listings
	maxReadFileLine: number // Maximum number of lines to read from a file before truncating
	maxImageFileSize: number // Maximum size of image files to process in MB
	maxTotalImageSize: number // Maximum total size for all images in a single read operation in MB

	experiments: Experiments // Map of experiment IDs to their enabled state

	mcpEnabled: boolean
	enableMcpServerCreation: boolean

	mode: Mode
	zgsmCodeMode?: "vibe" | "strict"
	customModes: ModeConfig[]
	toolRequirements?: Record<string, boolean> // Map of tool names to their requirements (e.g. {"apply_diff": true} if diffEnabled)

	cwd?: string // Current working directory
	telemetrySetting: TelemetrySetting
	telemetryKey?: string
	machineId?: string

	renderContext: "sidebar" | "editor"
	settingsImportedAt?: number
	historyPreviewCollapsed?: boolean

	cloudUserInfo: CloudUserInfo | null
	cloudIsAuthenticated: boolean
	cloudApiUrl?: string
	cloudOrganizations?: CloudOrganizationMembership[]
	sharingEnabled: boolean
	organizationAllowList: OrganizationAllowList
	organizationSettingsVersion?: number

	isBrowserSessionActive: boolean // Actual browser session state

	autoCondenseContext: boolean
	autoCondenseContextPercent: number
	marketplaceItems?: MarketplaceItem[]
	marketplaceInstalledMetadata?: { project: Record<string, any>; global: Record<string, any> }
	profileThresholds: Record<string, number>
	hasOpenedModeSelector: boolean
	openRouterImageApiKey?: string
	openRouterUseMiddleOutTransform?: boolean
	messageQueue?: QueuedMessage[]
	lastShownAnnouncementId?: string
	apiModelId?: string
	mcpServers?: McpServer[]
	hasSystemPromptOverride?: boolean
	mdmCompliant?: boolean
	remoteControlEnabled: boolean
	taskSyncEnabled: boolean
	featureRoomoteControlEnabled: boolean
}

export interface ClineSayTool {
	tool:
		| "editedExistingFile"
		| "appliedDiff"
		| "newFileCreated"
		| "codebaseSearch"
		| "readFile"
		| "fetchInstructions"
		| "listFilesTopLevel"
		| "listFilesRecursive"
		| "listCodeDefinitionNames"
		| "searchFiles"
		| "switchMode"
		| "newTask"
		| "finishTask"
		| "insertContent"
		| "generateImage"
		| "imageGenerated"
		| "runSlashCommand"
		| "updateTodoList"
	parentTaskId?: string
	path?: string
	diff?: string
	content?: string
	// Unified diff statistics computed by the extension
	diffStats?: { added: number; removed: number }
	regex?: string
	filePattern?: string
	mode?: string
	reason?: string
	isOutsideWorkspace?: boolean
	isProtected?: boolean
	additionalFileCount?: number // Number of additional files in the same read_file request
	lineNumber?: number
	query?: string
	batchFiles?: Array<{
		path: string
		lineSnippet: string
		isOutsideWorkspace?: boolean
		key: string
		content?: string
	}>
	batchDiffs?: Array<{
		path: string
		changeCount: number
		key: string
		content: string
		// Per-file unified diff statistics computed by the extension
		diffStats?: { added: number; removed: number }
		diffs?: Array<{
			content: string
			startLine?: number
		}>
	}>
	question?: string
	imageData?: string // Base64 encoded image data for generated images
	// Properties for runSlashCommand tool
	command?: string
	args?: string
	source?: string
	description?: string
}

// Must keep in sync with system prompt.
export const browserActions = [
	"launch",
	"click",
	"hover",
	"type",
	"press",
	"scroll_down",
	"scroll_up",
	"resize",
	"close",
] as const

export type BrowserAction = (typeof browserActions)[number]

export interface ClineSayBrowserAction {
	action: BrowserAction
	coordinate?: string
	size?: string
	text?: string
	executedCoordinate?: string
}

export type BrowserActionResult = {
	screenshot?: string
	logs?: string
	currentUrl?: string
	currentMousePosition?: string
	viewportWidth?: number
	viewportHeight?: number
}

export interface ClineAskUseMcpServer {
	serverName: string
	type: "use_mcp_tool" | "access_mcp_resource"
	toolName?: string
	arguments?: string
	uri?: string
	response?: string
}

export interface ClineApiReqInfo {
	request?: string
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
	cost?: number
	cancelReason?: ClineApiReqCancelReason
	streamingFailedMessage?: string
	apiProtocol?: "anthropic" | "openai"
	selectedLLM?: string
	selectReason?: string
	isAuto?: boolean
	originModelId?: string
}

export type ClineApiReqCancelReason = "streaming_failed" | "user_cancelled"
