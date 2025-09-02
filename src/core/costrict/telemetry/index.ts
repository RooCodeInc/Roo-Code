import { TelemetryService, PrometheusTelemetryClient } from "@roo-code/telemetry"
import type { ClineProvider } from "../../webview/ClineProvider"
import { ZgsmAuthConfig } from "../auth"
export * from "./constants"

export function initTelemetry(provider: ClineProvider) {
	const telemetryService = TelemetryService.instance
	const baseUrl = provider.getValue("zgsmBaseUrl") ?? ZgsmAuthConfig.getInstance().getDefaultApiBaseUrl()
	try {
		telemetryService.register(new PrometheusTelemetryClient(`${baseUrl}/pushgateway/api/v1`, false))
		telemetryService.setProvider(provider)
	} catch (error) {
		console.warn("Failed to register PrometheusTelemetryClient:", error)
	}
}
