import type { PostHook } from "../types"
import { appendToDoc } from "../utils/fileUtils"

export const docUpdater: PostHook = async (ctx, result) => {
	try {
		const res: any = result || {}
		// If verification failed, append a lesson to CLAUDE.md
		if (res.verification_failed) {
			const note = `\n- [${new Date().toISOString()}] Verification failed for intent ${ctx.intentId || "unknown"}: ${res.verification_message || "no message"}\n`
			await appendToDoc("CLAUDE.md", note)
		}
	} catch (err) {
		// swallow errors
	}
}
