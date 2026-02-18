import fs from "fs"
import crypto from "crypto"

export async function postHook(command: string, args: any, result: any) {
	// Compute SHA256 of the content
	const content = fs.readFileSync(args.file, "utf8")
	const hash = crypto.createHash("sha256").update(content).digest("hex")

	// Append trace
	const trace = {
		id: crypto.randomUUID(),
		timestamp: new Date().toISOString(),
		vcs: { revision_id: "git_sha_placeholder" },
		files: [
			{
				relative_path: args.file,
				conversations: [],
				ranges: [{ start_line: 0, end_line: content.split("\n").length, content_hash: hash }],
				related: [{ type: "specification", value: args.intent_id }],
			},
		],
	}

	fs.appendFileSync(".orchestration/agent_trace.jsonl", JSON.stringify(trace) + "\n")
}
