/**
 * PreToolUse Hook - Intent Validation & Context Injection
 * TRP1 Challenge Week 1 - Final Implementation
 */

import * as vscode from 'vscode';
import { HookContext, HookResult, CommandRiskLevel } from '../types';

export class PreToolUseHook {
  private intentCache: Map<string, any> = new Map();

  async execute(context: HookContext): Promise<HookResult> {
    // Step 1: Allow select_active_intent tool without validation
    if (context.toolName === 'select_active_intent') {
      return { allowed: true };
    }

    // Step 2: Check if intent is declared for code-modifying tools
    const codeModifyingTools = ['write_file', 'edit_file', 'delete_file', 'execute_command'];
    if (codeModifyingTools.includes(context.toolName) && !context.activeIntentId) {
      return {
        allowed: false,
        blocked: true,
        errorResponse: {
          error: 'PROTOCOL_VIOLATION',
          message: 'Must call select_active_intent() before code generation. Please declare your intent first.'
        }
      };
    }

    // Step 3: Load intent and validate scope for write operations
    if (context.toolName === 'write_file' && context.activeIntentId) {
      const intent = await this.loadIntent(context.activeIntentId);
      
      if (intent && intent.owned_scope) {
        const filePath = context.params?.filePath || '';
        const isInScope = intent.owned_scope.some((scope: string) => 
          filePath.startsWith(scope.replace('**', '').replace('*', ''))
        );
        
        if (!isInScope) {
          return {
            allowed: false,
            blocked: true,
            errorResponse: {
              error: 'SCOPE_VIOLATION',
              message: `Intent ${context.activeIntentId} cannot edit ${filePath}. Owned scopes: ${intent.owned_scope.join(', ')}`
            }
          };
        }
      }
    }

    // Step 4: Classify command risk
    const riskLevel = this.classifyRisk(context.toolName, context.params);
    
    // Step 5: HITL authorization for destructive commands
    if (riskLevel === CommandRiskLevel.Destructive) {
      const approved = await vscode.window.showWarningMessage(
        `⚠️ Destructive Command: ${context.toolName}`,
        { modal: true, detail: 'This action may permanently modify or delete files. Do you want to proceed?' },
        'Approve',
        'Cancel'
      );
      
      if (approved !== 'Approve') {
        return {
          allowed: false,
          blocked: true,
          errorResponse: {
            error: 'USER_REJECTED',
            message: 'User rejected destructive command execution'
          }
        };
      }
    }

    // Step 6: Return success with intent context for prompt injection
    return {
      allowed: true,
      metadata: {
        intentContext: context.activeIntentId ? await this.formatIntentContext(context.activeIntentId) : undefined,
        riskLevel
      }
    };
  }

  private async loadIntent(intentId: string): Promise<any> {
    // Check cache first
    if (this.intentCache.has(intentId)) {
      return this.intentCache.get(intentId);
    }

    // Load from .orchestration/active_intents.yaml
    try {
      const fs = require('fs');
      const path = require('path');
      const yamlPath = path.join(vscode.workspace.rootPath || '', '.orchestration', 'active_intents.yaml');
      
      if (fs.existsSync(yamlPath)) {
        const yaml = require('js-yaml');
        const content = fs.readFileSync(yamlPath, 'utf8');
        const data = yaml.load(content);
        
        const intent = data.active_intents?.find((i: any) => i.id === intentId);
        this.intentCache.set(intentId, intent);
        return intent;
      }
    } catch (error) {
      console.error('Failed to load intent:', error);
    }

    return null;
  }

  private classifyRisk(toolName: string, params?: any): CommandRiskLevel {
    const destructivePatterns = ['delete', 'remove', 'rm', 'rmdir', 'push --force', 'exec'];
    const safePatterns = ['read', 'list', 'search', 'get'];

    if (destructivePatterns.some(p => toolName.toLowerCase().includes(p))) {
      return CommandRiskLevel.Destructive;
    }
    
    if (safePatterns.some(p => toolName.toLowerCase().includes(p))) {
      return CommandRiskLevel.Safe;
    }

    return CommandRiskLevel.Review;
  }

  private async formatIntentContext(intentId: string): Promise<string> {
    const intent = await this.loadIntent(intentId);
    
    if (!intent) {
      return `<intent_context><id>${intentId}</id><status>NOT_FOUND</status></intent_context>`;
    }

    return `<intent_context>
  <id>${intent.id}</id>
  <name>${intent.name}</name>
  <status>${intent.status}</status>
  <constraints>
    ${intent.constraints?.map((c: string) => `<constraint>${c}</constraint>`).join('\n    ') || ''}
  </constraints>
  <owned_scope>
    ${intent.owned_scope?.map((s: string) => `<scope>${s}</scope>`).join('\n    ') || ''}
  </owned_scope>
</intent_context>`;
  }
}