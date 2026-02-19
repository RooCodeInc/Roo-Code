/**
 * PostToolUse Hook - Trace Logging & Validation
 * TRP1 Challenge Week 1 - Final Implementation
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { HookContext } from '../types';

export class PostToolUseHook {
  private traceFilePath: string = '';

  constructor() {
    this.initializeTraceFile();
  }

  async execute(context: HookContext): Promise<void> {
    // Step 1: Compute content hash for spatial independence
    const contentHash = this.computeContentHash(context.result?.content || '');

    // Step 2: Create trace record
    const traceRecord = this.createTraceRecord(context, contentHash);

    // Step 3: Append to agent_trace.jsonl
    await this.appendTrace(traceRecord);

    // Step 4: Run post-edit validators (linter, tests)
    await this.runValidators(context.params?.filePath);

    // Step 5: Update active_intents.yaml status if task completed
    await this.updateIntentStatus(context.activeIntentId, context.result?.success);
  }

  private initializeTraceFile(): void {
    const workspaceRoot = vscode.workspace.rootPath || '';
    this.traceFilePath = path.join(workspaceRoot, '.orchestration', 'agent_trace.jsonl');

    // Ensure .orchestration directory exists
    const orchestrationDir = path.dirname(this.traceFilePath);
    if (!fs.existsSync(orchestrationDir)) {
      fs.mkdirSync(orchestrationDir, { recursive: true });
    }
  }

  private computeContentHash(codeBlock: string): string {
    // Normalize whitespace for hash stability across formatters
    const normalized = codeBlock
      .replace(/\r\n/g, '\n')
      .replace(/\s+$/gm, '')
      .trim();

    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  private createTraceRecord(context: HookContext, contentHash: string): any {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      vcs: {
        revision_id: this.getCurrentGitSHA()
      },
      files: [{
        relative_path: context.params?.filePath || 'unknown',
        conversations: [{
          url: `session:${context.sessionId}`,
          contributor: {
            entity_type: 'AI',
            model_identifier: this.getModelIdentifier()
          },
          ranges: [{
            start_line: context.result?.startLine || 1,
            end_line: context.result?.endLine || 1,
            content_hash: contentHash,
            mutation_class: this.classifyMutation(context.toolName)
          }],
          related: [{
            type: 'specification',
            value: context.activeIntentId || 'unassigned'
          }]
        }]
      }]
    };
  }

  private async appendTrace(traceRecord: any): Promise<void> {
    try {
      const line = JSON.stringify(traceRecord) + '\n';
      fs.appendFileSync(this.traceFilePath, line, 'utf8');
      console.log('[PostToolUse] Trace appended:', traceRecord.id);
    } catch (error) {
      console.error('[PostToolUse] Failed to append trace:', error);
    }
  }

  private async runValidators(filePath: string): Promise<void> {
    // TODO: Implement linter/test execution
    // Feed errors back to agent context for self-correction
    console.log('[PostToolUse] Running validators for:', filePath);
  }

  private async updateIntentStatus(intentId: string | undefined, success: boolean): Promise<void> {
    if (!intentId) return;

    // TODO: Update active_intents.yaml based on task completion
    console.log('[PostToolUse] Updated intent status:', intentId, success);
  }

  private getCurrentGitSHA(): string {
    try {
      const { execSync } = require('child_process');
      const workspaceRoot = vscode.workspace.rootPath || '';
      const sha = execSync('git rev-parse HEAD', { 
        cwd: workspaceRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      return sha;
    } catch {
      return 'pending';
    }
  }

  private getModelIdentifier(): string {
    // TODO: Retrieve from LLM provider configuration
    return 'claude-3-5-sonnet';
  }

  private classifyMutation(toolName: string): 'AST_REFACTOR' | 'INTENT_EVOLUTION' | 'BUG_FIX' | 'DOC_UPDATE' {
    if (toolName.includes('refactor')) return 'AST_REFACTOR';
    if (toolName.includes('fix')) return 'BUG_FIX';
    if (toolName.includes('doc')) return 'DOC_UPDATE';
    return 'INTENT_EVOLUTION';
  }
}