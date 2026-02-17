import * as fs from "fs/promises"
import * as path from "path"
import { randomUUID, createHash } from "crypto"

import type { MutationClass, AgentTraceEntry } from "../models/AgentTrace"

export class PostHook {
  static async log(args: {
    filePath: string
    content: string
    intentId: string
    mutationClass: MutationClass
    contributorModel?: string
  }): Promise<void> {
    const cwd = process.cwd()
    const orchestrationDir = path.join(cwd, ".orchestration")
    const ledgerPath = path.join(orchestrationDir, "agent_trace.jsonl")

    await fs.mkdir(orchestrationDir, { recursive: true })

    const contentHash = createHash("sha256").update(args.content, "utf8").digest("hex")
    const now = new Date().toISOString()

    const entry: AgentTraceEntry = {
      id: randomUUID(),
      timestamp: now,
      files: [
        {
          relative_path: args.filePath,
          conversations: [
            {
              contributor: { entity_type: "AI", model_identifier: args.contributorModel },
              ranges: [
                {
                  start_line: 0,
                  end_line: Math.max(0, args.content.split("\n").length - 1),
                  content_hash: `sha256:${contentHash}`,
                },
              ],
              related: [{ type: "specification", value: args.intentId }],
            },
          ],
        },
      ],
    }

    const line = JSON.stringify(entry)
    await fs.appendFile(ledgerPath, line + "\n", "utf-8")
  }
}
