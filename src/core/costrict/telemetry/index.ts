import { TelemetryService, CostrictTelemetryClient } from "@roo-code/telemetry"
import type { ClineProvider } from "../../webview/ClineProvider"
import { ZgsmAuthConfig } from "../auth"
export * from "./constants"

export function initTelemetry(provider: ClineProvider) {
	const telemetryService = TelemetryService.instance
	const zgsmBaseUrl = provider.getValue("zgsmBaseUrl")
	const baseUrl = zgsmBaseUrl ? zgsmBaseUrl : ZgsmAuthConfig.getInstance().getDefaultApiBaseUrl()
	try {
		telemetryService.register(new CostrictTelemetryClient(`${baseUrl}`, false))
		telemetryService.setProvider(provider)
	} catch (error) {
		console.warn("Failed to register CostrictTelemetryClient:", error)
	}
}
