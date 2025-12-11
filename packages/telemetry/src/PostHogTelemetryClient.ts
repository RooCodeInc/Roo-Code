import { getClientId } from "./../../../src/utils/getClientId"
import { PostHog } from "posthog-node"
import * as vscode from "vscode"

import {
	type TelemetryProperties,
	type TelemetryEvent,
	TelemetryEventName,
	getErrorStatusCode,
	getErrorMessage,
	shouldReportApiErrorToTelemetry,
	isApiProviderError,
	extractApiProviderErrorProperties,
} from "@roo-code/types"

import { BaseTelemetryClient } from "./BaseTelemetryClient"

/**
 * PostHogTelemetryClient handles telemetry event tracking for the CoStrict extension.
 * Uses PostHog analytics to track user interactions and system events.
 * Respects user privacy settings and VSCode's global telemetry configuration.
 */
export class PostHogTelemetryClient extends BaseTelemetryClient {
	private client: PostHog
	private distinctId: string = getClientId()
	// Git repository properties that should be filtered out
	private readonly gitPropertyNames = ["repositoryUrl", "repositoryName", "defaultBranch"]

	constructor(debug = false) {
		super(
			{
				type: "exclude",
				events: [TelemetryEventName.TASK_MESSAGE, TelemetryEventName.LLM_COMPLETION],
			},
			debug,
		)

		this.client = new PostHog(process.env.POSTHOG_API_KEY || "", { host: "https://ph.roocode.com" })
	}

	/**
	 * Filter out git repository properties for PostHog telemetry
	 * @param propertyName The property name to check
	 * @returns Whether the property should be included in telemetry events
	 */
	protected override isPropertyCapturable(propertyName: string): boolean {
		// Filter out git repository properties
		if (this.gitPropertyNames.includes(propertyName)) {
			return false
		}
		return true
	}

	public override async capture(event: TelemetryEvent): Promise<void> {
		if (!this.isTelemetryEnabled() || !this.isEventCapturable(event.event)) {
			if (this.debug) {
				console.info(`[PostHogTelemetryClient#capture] Skipping event: ${event.event}`)
			}

			return
		}

		if (this.debug) {
			console.info(`[PostHogTelemetryClient#capture] ${event.event}`)
		}

		this.client.capture({
			distinctId: this.distinctId,
			event: event.event,
			properties: await this.getEventProperties(event),
		})
	}

	public override async captureException(
		error: Error,
		additionalProperties?: Record<string, unknown>,
	): Promise<void> {
		if (!this.isTelemetryEnabled()) {
			if (this.debug) {
				console.info(`[PostHogTelemetryClient#captureException] Skipping exception: ${error.message}`)
			}

			return
		}

		// Extract error status code and message for filtering.
		const errorCode = getErrorStatusCode(error)
		const errorMessage = getErrorMessage(error) ?? error.message

		// Filter out expected errors (e.g., 402 billing, 429 rate limits)
		if (!shouldReportApiErrorToTelemetry(errorCode, errorMessage)) {
			if (this.debug) {
				console.info(
					`[PostHogTelemetryClient#captureException] Filtering out expected error: ${errorCode} - ${errorMessage}`,
				)
			}
			return
		}

		if (this.debug) {
			console.info(`[PostHogTelemetryClient#captureException] ${error.message}`)
		}

		// Auto-extract properties from ApiProviderError and merge with additionalProperties.
		// Explicit additionalProperties take precedence over auto-extracted properties.
		let mergedProperties = additionalProperties

		if (isApiProviderError(error)) {
			const extractedProperties = extractApiProviderErrorProperties(error)
			mergedProperties = { ...extractedProperties, ...additionalProperties }
		}

		// Override the error message with the extracted error message.
		error.message = errorMessage

		const provider = this.providerRef?.deref()
		let telemetryProperties: TelemetryProperties | undefined = undefined

		if (provider) {
			try {
				telemetryProperties = await provider.getTelemetryProperties()
			} catch (_error) {
				// Ignore.
			}
		}

		this.client.captureException(error, this.distinctId, {
			...mergedProperties,
			$app_version: telemetryProperties?.appVersion,
		})
	}

	/**
	 * Updates the telemetry state based on user preferences and VSCode settings.
	 * Only enables telemetry if both VSCode global telemetry is enabled and
	 * user has opted in.
	 * @param didUserOptIn Whether the user has explicitly opted into telemetry
	 */
	public override updateTelemetryState(didUserOptIn: boolean): void {
		this.telemetryEnabled = false

		// First check global telemetry level - telemetry should only be enabled when level is "all".
		const telemetryLevel = vscode.workspace.getConfiguration("telemetry").get<string>("telemetryLevel", "all")
		const globalTelemetryEnabled = telemetryLevel === "all"

		// We only enable telemetry if global vscode telemetry is enabled.
		if (globalTelemetryEnabled) {
			this.telemetryEnabled = didUserOptIn
		}

		// Update PostHog client state based on telemetry preference.
		if (this.telemetryEnabled) {
			this.client.optIn()
		} else {
			this.client.optOut()
		}
	}

	public override async shutdown(): Promise<void> {
		await this.client.shutdown()
	}
}
