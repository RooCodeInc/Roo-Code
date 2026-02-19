/**
 * post/TraceLogger.ts
 * ─────────────────────────────────────────────────────────────
 * POST-HOOK #1 — The Ledger
 *
 * After every file write, appends an entry to agent_trace.jsonl.
 * This is the audit trail that links:
 *   Business Intent → Mutation Class → Code Hash → Git SHA
 *
 * Key properties:
 *   • Append-only (never mutates existing entries)
 *   • AST-based content hashing (spatial independence)
 *   • Deterministic mutation classification (not agent self-reported)
 *   • Links back to the intent ID declared in the Pre-Hook
 * ─────────────────────────────────────────────────────────────
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ToolContext } from '../HookEngine';
import { hashCodeBlock } from '../utils/astHasher';
import { classifyMutation } from '../utils/mutationClassifier';
import { getCurrentGitSha, toRelativePath } from '../utils/gitUtils';

const TRACE_FILE = path.join('.orchestration', 'agent_trace.jsonl');

export interface TraceEntry {
  id: string;
  timestamp: string;
  vcs: { revision_id: string | null };
  mutation_class: string;
  classification_reason: string;
  files: TraceFile[];
}

export interface TraceFile {
  relative_path: string;
  conversations: TraceConversation[];
}

export interface TraceConversation {
  session_id: string;
  contributor: {
    entity_type: 'AI' | 'HUMAN';
    model_identifier: string;
  };
  ranges: TraceRange[];
  related: TraceRelated[];
}

export interface TraceRange {
  start_line: number;
  end_line: number;
  content_hash: string;
  hash_method: 'ast' | 'raw';
  ast_node_count: number;
}

export interface TraceRelated {
  type: 'specification' | 'intent' | 'requirement';
  value: string;
}

// ── Main post-hook ─────────────────────────────────────────────

const WRITE_TOOLS = new Set([
  'write_file',
  'write_to_file',
  'create_file',
  'apply_diff',
  'replace_in_file',
]);

export async function traceLogger(ctx: ToolContext): Promise<ToolContext> {
  if (!WRITE_TOOLS.has(ctx.toolName)) return ctx;

  const targetPath = ctx.params['path'] as string ?? ctx.params['file_path'] as string;
  const newContent = ctx.params['content'] as string ?? ctx.params['new_content'] as string;

  if (!targetPath || newContent === undefined) return ctx;

  const relativePath = toRelativePath(ctx.workspacePath, path.resolve(ctx.workspacePath, targetPath));

  // Compute AST-based hash of the new content
  const hashResult = await hashCodeBlock(newContent, targetPath);

  // Classify mutation (deterministic — compare old vs new AST)
  const oldContent = ctx.__oldContent__ ?? '';
  const classification = await classifyMutation(oldContent, newContent, targetPath);

  // Get current git SHA
  const gitSha = getCurrentGitSha(ctx.workspacePath);

  const lineCount = newContent.split('\n').length;

  const entry: TraceEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    vcs: { revision_id: gitSha },
    mutation_class: ctx.mutationClass ?? classification.mutationClass,
    classification_reason: classification.reason,
    files: [
      {
        relative_path: relativePath,
        conversations: [
          {
            session_id: getSessionId(),
            contributor: {
              entity_type: 'AI',
              model_identifier: getModelIdentifier(ctx),
            },
            ranges: [
              {
                start_line: 1,
                end_line: lineCount,
                content_hash: hashResult.hash,
                hash_method: hashResult.method,
                ast_node_count: hashResult.nodeCount,
              },
            ],
            related: [
              {
                type: 'intent',
                value: ctx.intentId ?? 'UNLINKED',
              },
            ],
          },
        ],
      },
    ],
  };

  // Append to JSONL
  const tracePath = path.join(ctx.workspacePath, TRACE_FILE);
  fs.mkdirSync(path.dirname(tracePath), { recursive: true });
  fs.appendFileSync(tracePath, JSON.stringify(entry) + '\n', 'utf8');

  console.log(`[TraceLogger] Logged ${classification.mutationClass} for ${relativePath} (intent: ${ctx.intentId ?? 'UNLINKED'})`);

  return ctx;
}

// ── Helpers ────────────────────────────────────────────────────

let _sessionId: string | null = null;
function getSessionId(): string {
  if (!_sessionId) _sessionId = uuidv4();
  return _sessionId;
}

function getModelIdentifier(ctx: ToolContext): string {
  // Try to extract from context — extension may store this
  return (ctx.params['__model__'] as string) ?? 'unknown-model';
}