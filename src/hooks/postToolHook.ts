import * as fs from "fs"
import * as path from "path"
import crypto from "crypto"

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex")
}

async function appendAgentTrace(entry: any, cwd: string) {
  try {
    const dir = path.join(cwd, ".orchestration")
    await fs.promises.mkdir(dir, { recursive: true })
    const file = path.join(dir, "agent_trace.jsonl")
    await fs.promises.appendFile(file, JSON.stringify(entry) + "\n", "utf8")
  } catch (err) {
    // Best-effort: do not throw to avoid breaking tool result handling
    console.warn("postToolHook: failed to append agent trace", err)
  }
}

export default async function postToolHook(toolResult: any, ctx: { cwd: string; intentId?: string }) {
  // For write operations we expect either raw content or a file path
  try {
    const now = new Date().toISOString()
    const files: any[] = []

    if (toolResult?.path && typeof toolResult?.content === "string") {
      const contentHash = "sha256:" + sha256Hex(toolResult.content)
      files.push({ relative_path: toolResult.path, ranges: [{ start_line: 1, end_line: countLines(toolResult.content), content_hash: contentHash }] })
    } else if (toolResult?.filesChanged && Array.isArray(toolResult.filesChanged)) {
      for (const f of toolResult.filesChanged) {
        let content: string | null = null
        if (typeof f.content === "string") content = f.content
        else if (typeof f.path === "string") {
          try {
            content = await fs.promises.readFile(path.join(ctx.cwd, f.path), "utf8")
          } catch (e) {
            content = null
          }
        }
        const contentHash = content ? "sha256:" + sha256Hex(content) : null
        files.push({ relative_path: f.path, ranges: content ? [{ start_line: 1, end_line: countLines(content), content_hash: contentHash }] : [] })
      }
    }

    if (files.length > 0) {
      const trace = {
        id: `trace-${Date.now()}`,
        timestamp: now,
        vcs: { revision_id: null },
        files: files.map((f) => ({ relative_path: f.relative_path, conversations: [{ contributor: { entity_type: toolResult?.actor ?? "AI", model_identifier: toolResult?.model ?? "unknown" }, ranges: f.ranges || [], related: ctx.intentId ? [{ type: "specification", value: ctx.intentId }] : [] }] })),
      }
      await appendAgentTrace(trace, ctx.cwd)
    }
  } catch (err) {
    console.warn("postToolHook: error", err)
  }
}

function countLines(s: string) {
  return s.split(/\r?\n/).length
}
