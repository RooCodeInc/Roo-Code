import * as fs from "fs"
import * as path from "path"
import type { PreHookResult } from "./prePostHook"

const DESTRUCTIVE_TOOLS = ["write_to_file", "execute_command", "edit_file", "apply_patch", "apply_diff"]

async function loadIntentBlock(cwd: string, intentId: string): Promise<string | null> {
  try {
    const orchPath = path.join(cwd, ".orchestration", "active_intents.yaml")
    const raw = await fs.promises.readFile(orchPath, "utf8")

    // Simple extraction: find the intent block starting with `- id: "<intentId>"` and capture until next `- id:` or EOF
    const idPattern = new RegExp(`^-\s*id:\s*\\"${intentId}\\"`, "m")
    const lines = raw.split(/\r?\n/)
    let start = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(new RegExp(`^\s*-\s*id:\s*\"${intentId}\"`))) {
        start = i
        break
      }
    }
    if (start === -1) return null

    let end = lines.length
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].match(/^\s*-\s*id:\s*\".*\"/)) {
        end = i
        break
      }
    }

    const block = lines.slice(start, end).join("\n")
    return block
  } catch (err) {
    return null
  }
}

export default async function preToolHook(toolUse: any, ctx: { cwd: string; intentId?: string }): Promise<PreHookResult> {
  // If tool is destructive, require an intent id
  const toolName: string = toolUse?.name ?? toolUse?.command ?? ""

  if (DESTRUCTIVE_TOOLS.includes(toolName)) {
    if (!ctx.intentId) {
      return { allowed: false, error: "Missing intentId: select_active_intent must be called before mutating operations." }
    }

    // Try to load the intent block and inject it as XML fragment
    const block = await loadIntentBlock(ctx.cwd, ctx.intentId)
    if (block) {
      // Minimal conversion: wrap YAML block in an <intent_context> block so it can be injected into prompts
      const injected = `\n<intent_context id=\"${ctx.intentId}\">\n${escapeXml(block)}\n</intent_context>\n`
      return { allowed: true, injectedContext: injected }
    }
    // If the intent id is not found, still allow but warn via injected context
    const injected = `\n<intent_context id=\"${ctx.intentId}\">\n<!-- intent not found in .orchestration/active_intents.yaml -->\n</intent_context>\n`
    return { allowed: true, injectedContext: injected }
  }

  // Non-destructive tools: allow without intent, but keep extension points
  return { allowed: true }
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
