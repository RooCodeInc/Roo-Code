import { z } from "zod"

/**
 * CodeAction
 */

export const codeActionIds = ["explainCode", "fixCode", "improveCode", "addToContext", "newTask"] as const

export type CodeActionId = (typeof codeActionIds)[number]

export type CodeActionName =
	| "EXPLAIN"
	| "FIX"
	| "IMPROVE"
	| "ADD_TO_CONTEXT"
	| "NEW_TASK"
	| "ZGSM_EXPLAIN"
	| "ZGSM_ADD_COMMENT"
	| "ZGSM_CODE_REVIEW"
	| "ZGSM_ADD_DEBUG_CODE"
	| "ZGSM_ADD_STRONG_CODE"
	| "ZGSM_SIMPLIFY_CODE"
	| "ZGSM_PERFORMANCE"

/**
 * TerminalAction
 */

export const terminalActionIds = ["terminalAddToContext", "terminalFixCommand", "terminalExplainCommand"] as const

export type TerminalActionId = (typeof terminalActionIds)[number]

export type TerminalActionName = "ADD_TO_CONTEXT" | "FIX" | "EXPLAIN"

export type TerminalActionPromptType = `TERMINAL_${TerminalActionName}`

/**
 * Command
 */

export const commandIds = [
	"activationCompleted",

	"plusButtonClicked",
	"historyButtonClicked",
	"marketplaceButtonClicked",
	"popoutButtonClicked",
	"openNewButtonClicked",
	"cloudButtonClicked",
	"settingsButtonClicked",

	"openInNewTab",

	"showHumanRelayDialog",
	"registerHumanRelayCallback",
	"unregisterHumanRelayCallback",
	"handleHumanRelayResponse",

	"newTask",

	"setCustomStoragePath",
	"importSettings",

	"focusInput",
	"acceptInput",
	"focusPanel",
	"addFileToContext",
	"toggleAutoApprove",
	"generateCommitMessage",
] as const

export const costrictCommandIds = [
	// code review
	"codeReviewButtonClicked",
	"codeReview",
	"codeReviewJetbrains",
	"reviewFilesAndFoldersJetbrains",
	"askReviewSuggestionWithAIJetbrains",
	"acceptIssueJetbrains",
	"rejectIssueJetbrains",
	"reviewFilesAndFolders",
	"reviewRepo",
	"reviewCommit",
	"askReviewSuggestionWithAI",
	"acceptIssue",
	"rejectIssue",
	"view.issue",
	"SidebarProvider.focus",
	"view.userHelperDoc",
	"codelens_button",
	"codelens_more_button",
	"login",
	"logout",
	"checkLoginStatus",
	"refreshToken",
	"coworkflow.updateSection",
	"coworkflow.runTask",
	"coworkflow.runAllTasks",
	"coworkflow.retryTask",
	"coworkflow.refreshCodeLens",
	"coworkflow.refreshDecorations",
	"coworkflow.runTest",
	"coworkflow.runTaskJetbrains",
	"coworkflow.runAllTasksJetbrains",
	"coworkflow.retryTaskJetbrains",
	"coworkflow.syncToDesignJetbrains",
	"coworkflow.syncToTasksJetbrains",
	"coworkflow.runTestJetbrains",
] as const
export type CostrictCommandId = (typeof costrictCommandIds)[number]
export type CommandId = (typeof commandIds)[number]

/**
 * Language
 */

export const languages = [
	"ca",
	"de",
	"en",
	"es",
	"fr",
	"hi",
	"id",
	"it",
	"ja",
	"ko",
	"nl",
	"pl",
	"pt-BR",
	"ru",
	"tr",
	"vi",
	"zh-CN",
	"zh-TW",
] as const

export const languagesSchema = z.enum(languages)

export type Language = z.infer<typeof languagesSchema>

export const isLanguage = (value: string): value is Language => languages.includes(value as Language)
