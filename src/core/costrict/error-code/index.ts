import { ClineProvider } from "../../webview/ClineProvider"
import { ErrorCodeManager } from "./ErrorCodeManager"

export async function initErrorCodeManager(provider: ClineProvider) {
	try {
		const errorCodeManager = ErrorCodeManager.getInstance()
		await errorCodeManager.initialize(provider)
	} catch (err) {
		provider.log(`[CoStrict#initErrorCodeManager] Failed to initialize error code manager: ${err}`)
	}
}

export { ErrorCodeManager }
