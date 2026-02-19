// src/hooks/hookEngine.ts
import * as fs from "fs"
import * as crypto from "crypto"
import * as path from "path"
import * as yaml from "js-yaml" // Assume installed or add dependency

export class HookEngine {
	private activeIntent: any = null
	private workspaceRoot: string

	constructor(workspaceRoot: string = "") {
		this.workspaceRoot = workspaceRoot
	}

	async onPreToolUse(invocation: any) {
		return this.preHook(invocation.tool, invocation.arguments)
	}

	async onPostToolUse(invocation: any, result: any) {
		return this.postHook(invocation.tool, invocation.arguments, result)
	}

	async onPreWrite(args: any) {
		if (!this.activeIntent && args.intentId) {
			this.activeIntent = { id: args.intentId } // Minimal fallback
		}
		return this.preHook("write_to_file", { ...args, relative_path: args.path })
	}

	async onPostWrite(args: any) {
		return this.postHook("write_to_file", { ...args, relative_path: args.path }, null)
	}

	preHook(toolName: string, args: any) {
		if (toolName === "select_active_intent") {
			// Load context from active_intents.yaml
			const configPath = path.join(this.workspaceRoot, ".orchestration", "active_intents.yaml")
			if (!fs.existsSync(configPath)) return
			const intents = yaml.load(fs.readFileSync(configPath, "utf8")) as any
			this.activeIntent = intents.active_intents.find((i: any) => i.id === args.intent_id)
			if (!this.activeIntent) throw new Error("Invalid Intent ID")
			// Inject context (return XML block)
			return `<intent_context>${JSON.stringify(this.activeIntent)}</intent_context>`
		}
		if (toolName === "write_to_file" && !this.activeIntent) {
			throw new Error("Must select intent first")
		}
		// Scope check
		if (toolName === "write_to_file" && this.activeIntent && this.activeIntent.owned_scope) {
			if (!this.activeIntent.owned_scope.some((scope: string) => args.relative_path.startsWith(scope))) {
				throw new Error("Scope Violation")
			}
		}
		return null
	}

	postHook(toolName: string, args: any, result: any) {
		if (toolName === "write_to_file") {
			// Compute hash
			const contentHash = crypto
				.createHash("sha256")
				.update(args.content || "")
				.digest("hex")
			// Append to agent_trace.jsonl
			const traceEntry = {
				id: crypto.randomUUID(),
				timestamp: new Date().toISOString(),
				vcs: { revision_id: "git_sha_placeholder" }, // Integrate git rev-parse HEAD
				files: [
					{
						relative_path: args.relative_path,
						conversations: [
							{
								url: "session_placeholder",
								contributor: { entity_type: "AI", model_identifier: "claude-3-5-sonnet" },
								ranges: [{ start_line: 1, end_line: 10, content_hash: contentHash }], // Adjust lines
								related: [{ type: "specification", value: this.activeIntent?.id }],
							},
						],
					},
				],
			}
			const tracePath = path.join(this.workspaceRoot, ".orchestration", "agent_trace.jsonl")
			const dir = path.dirname(tracePath)
			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
			fs.appendFileSync(tracePath, JSON.stringify(traceEntry) + "\n")
		}
	}
}
