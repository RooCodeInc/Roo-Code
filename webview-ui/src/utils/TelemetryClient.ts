import posthog from "posthog-js"

import type { TelemetrySetting } from "@roo-code/types"
import { vscode } from "./vscode"

class TelemetryClient {
	private static instance: TelemetryClient
	private static telemetryEnabled: boolean = false

	public updateTelemetryState(telemetrySetting: TelemetrySetting, apiKey?: string, distinctId?: string) {
		posthog.reset()

		if (telemetrySetting === "enabled" && apiKey && distinctId) {
			TelemetryClient.telemetryEnabled = true

			posthog.init(apiKey, {
				api_host: "https://ph.roocode.com",
				ui_host: "https://us.posthog.com",
				persistence: "localStorage",
				loaded: () => posthog.identify(distinctId),
				capture_pageview: false,
				capture_pageleave: false,
				autocapture: false,
			})
		} else {
			TelemetryClient.telemetryEnabled = false
		}
	}

	public static getInstance(): TelemetryClient {
		if (!TelemetryClient.instance) {
			TelemetryClient.instance = new TelemetryClient()
		}

		return TelemetryClient.instance
	}

	public capture(eventName: string, properties?: Record<string, any>) {
		vscode.postMessage({
			type: "costrictTelemetry",
			values: {
				eventName,
				properties,
			},
		})
	}
}

export const telemetryClient = TelemetryClient.getInstance()
