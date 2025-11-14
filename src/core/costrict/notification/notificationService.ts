import axios from "axios"
import * as vscode from "vscode"
import { ClineProvider } from "../../webview/ClineProvider"
import { ZgsmAuthConfig } from "../auth"
import { t } from "../../../i18n"

export interface INotice {
	title: string
	type: "always" | "once"
	content: string
	timestamp: number
	expired: number
}

export interface INoticesResponse {
	notices: INotice[]
}

export class NotificationService {
	private provider: ClineProvider | null = null
	private static instance: NotificationService
	private fetchTimer: NodeJS.Timeout | null = null
	private readonly FETCH_INTERVAL = 60 * 60 * 1000 // 1 hour in milliseconds
	private isInitialized = false

	private constructor() {}

	public static getInstance(): NotificationService {
		if (!NotificationService.instance) {
			NotificationService.instance = new NotificationService()
		}
		return NotificationService.instance
	}

	public async initialize(provider: ClineProvider): Promise<void> {
		this.provider = provider
		if (this.isInitialized) {
			return
		}
		// Fetch immediately on initialization
		try {
			this.isInitialized = true
			const response = await this.fetchNotices()
			await this.processAndSendNotices(response.notices || [])
		} catch (error) {
			console.error("Failed to fetch notices during initialization:", error)
		}
		// Start periodic fetching
		this.startPeriodicFetch()
	}

	/**
	 * Start periodic fetching of notices
	 */
	private startPeriodicFetch(): void {
		// Clear existing timer if any
		this.stopPeriodicFetch()
		// Set up interval to fetch every hour
		this.fetchTimer = setInterval(async () => {
			try {
				const response = await this.fetchNotices()
				await this.processAndSendNotices(response.notices || [])
			} catch (error) {
				console.error("Failed to fetch notices periodically:", error)
			}
		}, this.FETCH_INTERVAL)
	}

	/**
	 * Stop periodic fetching of notices
	 */
	public stopPeriodicFetch(): void {
		if (this.fetchTimer) {
			clearInterval(this.fetchTimer)
			this.fetchTimer = null
		}
	}

	/**
	 * Fetch notices from remote
	 * @returns Promise<INoticesResponse> Remote notices data
	 */
	public async fetchNotices(): Promise<INoticesResponse> {
		try {
			if (!this.provider) {
				throw new Error("NotificationService not initialized")
			}
			const { language, apiConfiguration } = await this.provider.getState()
			const baseUrl = apiConfiguration.zgsmBaseUrl || ZgsmAuthConfig.getInstance().getDefaultApiBaseUrl()
			const response = await axios.get(`${baseUrl}/costrict/announcement/announcement_${language}.json`)
			return response.data
		} catch (error) {
			console.error("Failed to fetch remote notices:", error)
			throw error
		}
	}

	/**
	 * Process notices and send to webview
	 * Filters and sends "always" type notices, can be extended for "once" type logic
	 */
	private async processAndSendNotices(notices: INotice[]): Promise<void> {
		if (!this.provider) {
			return
		}

		// Filter notices with type "always" and send to webview
		const alwaysNotices = notices.filter((notice) => notice.type === "always")
		if (alwaysNotices.length > 0) {
			await this.provider.postMessageToWebview({
				type: "zgsmNotices",
				notices: alwaysNotices,
			})
		}

		// Handle "once" type notices
		const onceNotices = notices.filter((notice) => notice.type === "once")
		if (onceNotices.length > 0) {
			await this.processOnceNotices(onceNotices)
		}
	}

	/**
	 * Process "once" type notices
	 * Shows VS Code message dialog for notices that haven't been clicked and aren't expired
	 */
	private async processOnceNotices(notices: INotice[]): Promise<void> {
		if (!this.provider) {
			return
		}
		// Get clicked notices from storage
		let clickedNotices = (this.provider.getValue("clickedOnceNotices") as number[]) || []
		const currentTime = Math.floor(Date.now() / 1000) // Current time in seconds

		// Filter notices that should be shown
		const noticesToShow = notices.filter((notice) => {
			// Check if already clicked
			if (clickedNotices.includes(notice.timestamp)) {
				return false
			}

			// Check if expired
			// If expired === 0, the notice never expires
			if (notice.expired > 0) {
				const expirationTime = notice.timestamp + notice.expired
				if (currentTime > expirationTime) {
					return false
				}
			}

			return true
		})

		// Show each notice in VS Code message dialog
		for (const notice of noticesToShow) {
			const confirmText = t("common:notification.confirm")
			const result = await vscode.window.showInformationMessage(notice.content, confirmText)

			// If user clicked confirmText, mark as clicked
			if (result === confirmText) {
				// Add timestamp to clicked notices list
				clickedNotices = [...clickedNotices, notice.timestamp]
				await this.provider.setValue("clickedOnceNotices", clickedNotices)
			}
		}
	}
}
