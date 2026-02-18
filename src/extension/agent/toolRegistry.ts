import * as vscode from "vscode"
import { loadActiveIntentContext } from "../../hooks/preHooks/intentHandshakePreHook"
// import your ToolExecutor type if needed

export function registerTools(executor: any) {
	executor.register("select_active_intent", async (args: any) => {
		const intentId = String(args.intent_id || "")
		if (!intentId) throw new Error("You must provide intent_id")
		const ctx = loadActiveIntentContext(executor.workspaceRoot, intentId)
		return { intent_id: intentId, intent_context: ctx }
	})

	executor.register("write_file", async (args: any) => {
		const rel = String(args.path)
		const content = String(args.content ?? "")
		const intentId = String(args.intent_id || "")
		const mutationClass = String(args.mutation_class || "")

		await executor.preWriteCheck({ path: rel, intentId, mutationClass })

		const uri = vscode.Uri.joinPath(vscode.Uri.file(executor.workspaceRoot), rel)
		await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"))

		await executor.postWriteTrace({ path: rel, content, intentId, mutationClass })

		return { ok: true }
	})
}
