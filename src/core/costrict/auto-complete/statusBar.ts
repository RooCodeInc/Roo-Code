import * as vscode from "vscode"
import {
	handleStatusBarClick,
	configCompletion,
	OPENAI_CLIENT_NOT_INITIALIZED,
	OPENAI_REQUEST_ABORTED,
} from "../base/common"
import { t } from "../../../i18n"
interface IFailError {
	message?: string
	status?: number
	[key: string]: any
}
const statusBarCommand = "zgsm-statusBar.showInformationMessage"
export class CompletionStatusBar {
	private static _instance: CompletionStatusBar
	private _statusBar: vscode.StatusBarItem

	private constructor() {
		this._statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right)
	}

	public static getInstance(): CompletionStatusBar {
		if (!CompletionStatusBar._instance) {
			CompletionStatusBar._instance = new CompletionStatusBar()
		}
		return CompletionStatusBar._instance
	}
	public init(context?: vscode.ExtensionContext) {
		if (!context) {
			throw new Error("Plugin exception, completionStatusBar instance is abnormally lost")
		}

		this._statusBar.command = statusBarCommand
		const statusUpdateCallback = (callback: (...args: any[]) => any, showIcon: boolean) => async () => {
			await callback?.()
			if (showIcon) {
				this._statusBar.show()
			} else {
				this._statusBar.hide()
			}
		}
		context.subscriptions.push(
			vscode.commands.registerCommand(statusBarCommand, handleStatusBarClick),
			vscode.commands.registerCommand(
				"zgsm-completion.enable",
				statusUpdateCallback(() => this.setExtensionStatus(true), true),
			),
			vscode.commands.registerCommand(
				"zgsm-completion.disable",
				statusUpdateCallback(() => this.setExtensionStatus(false), false),
			),
		)
	}
	public setEnableState(enabled?: boolean) {
		if (enabled === undefined) {
			enabled = vscode.workspace.getConfiguration(configCompletion).get("enabled")
		}
		this._statusBar.text = t("common:completion.status.complete.text")
		if (enabled) {
			this._statusBar.tooltip = t("common:completion.status.enabled.tooltip")
		} else {
			this._statusBar.tooltip = t("common:completion.status.disabled.tooltip")
		}
		this._statusBar.show()
	}
	public loading() {
		this._statusBar.tooltip = t("common:completion.status.loading.tooltip")
		this._statusBar.text = t("common:completion.status.loading.text")
		this._statusBar.show()
	}
	public notSupport() {
		this._statusBar.tooltip = t("common:completion.status.notSupport.tooltip")
		this._statusBar.text = t("common:completion.status.notSupport.text")
		this._statusBar.show()
	}
	public disable() {
		this._statusBar.tooltip = t("common:completion.status.disabled.tooltip")
		this._statusBar.text = t("common:completion.status.complete.text")
		this._statusBar.show()
	}
	public complete() {
		this._statusBar.tooltip = t("common:completion.status.complete.tooltip")
		this._statusBar.text = t("common:completion.status.complete.text")
		this._statusBar.show()
	}
	public fail(error: IFailError) {
		let codeMsg
		let solutionMsg

		// Build user-friendly error message
		if (error.status === 401) {
			codeMsg = t("common:completion.code.401")
			solutionMsg = t("common:completion.solution.401")
		} else if (error.status === 400) {
			codeMsg = t("common:completion.code.400")
			solutionMsg = t("common:completion.solution.400")
		} else if (error.status === 403) {
			codeMsg = t("common:completion.code.403")
			solutionMsg = t("common:completion.solution.403")
		} else if (error.status === 404) {
			codeMsg = t("common:completion.code.404")
			solutionMsg = t("common:completion.solution.404")
		} else if (error.status === 500) {
			codeMsg = t("common:completion.code.500")
			solutionMsg = t("common:completion.solution.500")
		} else if (error.status === 502) {
			codeMsg = t("common:completion.code.502")
			solutionMsg = t("common:completion.solution.502")
		} else if (error.status === 503) {
			codeMsg = t("common:completion.code.503")
			solutionMsg = t("common:completion.solution.503")
		} else if (error.status === 504) {
			codeMsg = t("common:completion.code.504")
			solutionMsg = t("common:completion.solution.504")
		} else if (error.status === 429) {
			codeMsg = t("common:completion.code.429")
			solutionMsg = t("common:completion.solution.429")
		} else if (error.message?.includes(OPENAI_CLIENT_NOT_INITIALIZED)) {
			codeMsg = t("common:completion.code.401")
			solutionMsg = t("common:completion.solution.401")
		} else if (error.message?.includes(OPENAI_REQUEST_ABORTED)) {
			codeMsg = t("common:completion.code.aborted")
			solutionMsg = t("common:completion.solution.aborted")
		} else {
			codeMsg = t("common:completion.code.unknown")
			solutionMsg = t("common:completion.solution.unknown")
		}

		this._statusBar.tooltip = t("common:completion.status.fail.tooltip") + solutionMsg
		this._statusBar.text = t("common:completion.status.fail.text") + codeMsg
		this._statusBar.show()
	}
	public noSuggest() {
		this._statusBar.tooltip = t("common:completion.status.noSuggest.tooltip")
		this._statusBar.text = t("common:completion.status.noSuggest.text")
		this._statusBar.show()
	}
	public get statusBar(): vscode.StatusBarItem {
		return this._statusBar
	}
	private setExtensionStatus(enabled: boolean) {
		const config = vscode.workspace.getConfiguration()
		const target = vscode.ConfigurationTarget.Global
		config.update("zgsm-completion.enabled", enabled, target, false).then(console.error)
	}
}
