/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as vscode from "vscode"
import { StatusBarItem } from "vscode"
import { configCompletion, OPENAI_CLIENT_NOT_INITIALIZED, OPENAI_REQUEST_ABORTED } from "../base/common/constant"
import { Logger } from "../base/common/log-util"
import { statusBarCommand, turnOffCompletion, turnOnCompletion } from "./completionCommands"
import { t } from "../../../i18n"

interface IFailError {
	message?: string
	status?: number
	[key: string]: any
}

/**
 * Status bar at the bottom right of vscode
 */
export class CompletionStatusBar {
	// Singleton to ensure a globally unique instance
	private static instance: StatusBarItem

	// Private constructor to prevent external instantiation
	private constructor() {}

	/**
	 * Create the status bar for the completion feature, which needs to be called in the plugin registration function
	 */
	public static create(context?: vscode.ExtensionContext): StatusBarItem {
		if (this.instance) {
			return this.instance
		}
		const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right)
		statusBar.command = statusBarCommand.command
		if (!context) {
			Logger.log("Plugin exception, completionStatusBar instance is abnormally lost")
			throw new Error("Plugin exception, completionStatusBar instance is abnormally lost")
		}
		const statusUpdateCallback = (callback: (...args: any[]) => any, showIcon: boolean) => async () => {
			await callback?.()
			if (showIcon) {
				statusBar.show()
			} else {
				statusBar.hide()
			}
		}
		// Define commands
		context.subscriptions.push(
			vscode.commands.registerCommand(statusBar.command, statusBarCommand.callback),
			vscode.commands.registerCommand(
				turnOnCompletion.command,
				statusUpdateCallback(turnOnCompletion.callback, true),
			),
			vscode.commands.registerCommand(
				turnOffCompletion.command,
				statusUpdateCallback(turnOffCompletion.callback, false),
			),
		)

		this.instance = statusBar

		return this.instance
	}

	/**
	 * Initialize the initial display status of the status bar based on the configuration
	 */
	public static initByConfig(suggestion_switch?: boolean) {
		if (!this.instance) this.create({ subscriptions: [] } as any)
		if (suggestion_switch === undefined) {
			suggestion_switch = vscode.workspace.getConfiguration(configCompletion).get("enabled")
		}
		this.instance.text = t("common:completion.status.complete.text")
		if (suggestion_switch) {
			this.instance.tooltip = t("common:completion.status.enabled.tooltip")
		} else {
			this.instance.tooltip = t("common:completion.status.disabled.tooltip")
		}
		this.instance.show()
	}

	/**
	 * Waiting for request results
	 */
	public static loading() {
		if (!this.instance) this.create({ subscriptions: [] } as any)
		this.instance.tooltip = t("common:completion.status.loading.tooltip")
		this.instance.text = t("common:completion.status.loading.text")
		this.instance.show()
	}

	/**
	 * api provider not zgsm
	 */
	public static disable() {
		if (!this.instance) this.create({ subscriptions: [] } as any)
		this.instance.tooltip = "Only CoStrict provider supports this service"
		this.instance.text = t("common:completion.status.complete.text")
		this.instance.show()
	}

	/**
	 * Completion is done
	 */
	public static complete() {
		if (!this.instance) this.create({ subscriptions: [] } as any)
		this.instance.tooltip = t("common:completion.status.complete.tooltip")
		this.instance.text = t("common:completion.status.complete.text")
		this.instance.show()
	}

	/**
	 * Completion failed
	 */
	public static fail(error: IFailError) {
		if (!this.instance) this.create({ subscriptions: [] } as any)
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

		this.instance.tooltip = t("common:completion.status.fail.tooltip") + solutionMsg
		this.instance.text = t("common:completion.status.fail.text") + codeMsg
		this.instance.show()
	}

	/**
	 * Completion succeeded, but no suggestions
	 */
	public static noSuggest() {
		if (!this.instance) this.create({ subscriptions: [] } as any)
		this.instance.tooltip = t("common:completion.status.noSuggest.tooltip")
		this.instance.text = t("common:completion.status.noSuggest.text")
		this.instance.show()
	}

	public static login() {
		if (!this.instance) this.create({ subscriptions: [] } as any)
		this.instance.command = undefined
		this.instance.text = t("common:completion.status.login.text")
		this.instance.tooltip = ""
		this.instance.show()
	}

	public static resetCommand() {
		if (!this.instance) this.create({ subscriptions: [] } as any)
		this.instance.command = statusBarCommand.command
	}
}
