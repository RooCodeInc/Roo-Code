/// <reference types="node" />
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
    astNodeType?: string
  }): Promise<void> {
    const cwd = process.cwd()
    const orchestrationDir = path.join(cwd, ".orchestration")
    const ledgerPath = path.join(orchestrationDir, "agent_trace.jsonl")

    await fs.mkdir(orchestrationDir, { recursive: true })

    const contentHash = computeContentHash(args.content)
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
              ast_node_type: args.astNodeType,
              intent_id: args.intentId,
              classification: mapClassification(args.mutationClass),
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

function computeContentHash(code: string): string {
  const normalized = code.trim().replace(/\s+/g, " ")
  return createHash("sha256").update(normalized, "utf8").digest("hex")
}

function mapClassification(mutationClass: MutationClass): "REFACTOR" | "FEATURE" | "BUGFIX" | undefined {
  switch (mutationClass) {
    case "AST_REFACTOR":
      return "REFACTOR"
    case "INTENT_EVOLUTION":
      return "FEATURE"
    default:
      return undefined
  }
}
