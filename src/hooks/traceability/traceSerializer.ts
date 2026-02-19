/**
 * Trace Serializer - Agent Trace Schema Implementation
 * TRP1 Challenge Week 1 - Final Implementation
 */

import * as crypto from 'crypto';
import * as child_process from 'child_process';
import { AgentTraceRecord } from '../types';

export interface TraceData {
  toolName: string;
  params: any;
  result: any;
  sessionId: string;
  activeIntentId: string;
  contentHash: string;
  filePath: string;
  startLine: number;
  endLine: number;
  modelId?: string;
}

export class TraceSerializer {
  /**
   * Serialize tool execution into Agent Trace schema
   */
  serialize(data: TraceData): AgentTraceRecord {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      vcs: {
        revision_id: this.getCurrentGitSHA()
      },
      files: [{
        relative_path: data.filePath,
        conversations: [{
          url: `session:${data.sessionId}`,
          contributor: {
            entity_type: 'AI',
            model_identifier: data.modelId || 'claude-3-5-sonnet'
          },
          ranges: [{
            start_line: data.startLine,
            end_line: data.endLine,
            content_hash: data.contentHash,
            mutation_class: this.classifyMutation(data.toolName)
          }],
          related: [{
            type: 'specification',
            value: data.activeIntentId || 'unassigned'
          }]
        }]
      }]
    };
  }

  /**
   * Convert trace record to JSONL line
   */
  toJSONL(trace: AgentTraceRecord): string {
    return JSON.stringify(trace) + '\n';
  }

  /**
   * Get current Git SHA for VCS tracking
   */
  private getCurrentGitSHA(): string {
    try {
      const sha = child_process.execSync('git rev-parse HEAD', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      return sha;
    } catch {
      return 'pending';
    }
  }

  /**
   * Classify mutation type based on tool name
   */
  private classifyMutation(toolName: string): 'AST_REFACTOR' | 'INTENT_EVOLUTION' | 'BUG_FIX' | 'DOC_UPDATE' {
    const name = toolName.toLowerCase();
    
    if (name.includes('refactor')) return 'AST_REFACTOR';
    if (name.includes('fix') || name.includes('bug')) return 'BUG_FIX';
    if (name.includes('doc') || name.includes('comment')) return 'DOC_UPDATE';
    return 'INTENT_EVOLUTION';
  }
}