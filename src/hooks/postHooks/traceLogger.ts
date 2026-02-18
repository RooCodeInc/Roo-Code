import type { PostHook } from "../types"
import { appendAgentTrace } from "../utils/fileUtils"
import { prefixedSha256 } from "../utils/hashUtils"

export const traceLogger: PostHook = async (ctx, result) => {
	try {
		const op = result && (result as any).operation
		if (op !== "write_file") return

		const res: any = result
		const content: string = res.content ?? ""
		const path = res.path ?? res.filePath ?? "unknown"

		const ranges = [
			{
				start_line: res.start_line ?? 1,
				end_line: res.end_line ?? (content ? content.split("\n").length : 0),
				content_hash: prefixedSha256(content),
			},
		]

		const entry = {
			id:
				typeof globalThis !== "undefined" && (globalThis as any).crypto && (globalThis as any).crypto.randomUUID
					? (globalThis as any).crypto.randomUUID()
					: String(Date.now()),
			timestamp: new Date().toISOString(),
			vcs: { revision_id: null },
			files: [
				{
					relative_path: path,
					conversations: [
						{
							url: res.session_id ?? null,
							contributor: res.contributor ?? {
								entity_type: "AI",
								model_identifier: res.model ?? "unknown",
							},
							ranges,
							related: res.related ?? [],
						},
					],
				},
			],
			intent_id: ctx.intentId ?? null,
			mutation_class: res.mutation_class ?? null,
		}

		await appendAgentTrace(entry)
	} catch (err) {
		// best effort logging; swallow errors
	}
}
