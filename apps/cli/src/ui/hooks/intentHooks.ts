// src/hooks/intentHooks.ts
import fs from 'fs';
import yaml from 'js-yaml';

interface Intent {
  id: string;
  name: string;
  status: string;
  owned_scope: string[];
  constraints: string[];
  acceptance_criteria: string[];
}

export class IntentHookEngine {
  private intents: Record<string, Intent>;

  constructor() {
    this.intents = this.loadIntents();
  }

  private loadIntents(): Record<string, Intent> {
    const file = fs.readFileSync('.orchestration/active_intents.yaml', 'utf8');
    const data = yaml.load(file) as any;
    const intents: Record<string, Intent> = {};
    data.active_intents.forEach((intent: Intent) => {
      intents[intent.id] = intent;
    });
    return intents;
  }

  /**
   * Pre-Hook logic for select_active_intent
   * - Validates intent_id
   * - Injects constraints and scope
   * - Returns XML <intent_context> block
   */
  preHook(tool: string, payload: any) {
    if (tool === 'select_active_intent') {
      const intentId = payload.intent_id;
      const intent = this.intents[intentId];

      // Gatekeeper: block if invalid
      if (!intent) {
        throw new Error("You must cite a valid active Intent ID");
      }

      // Construct XML block
      return `<intent_context>
        <constraints>${intent.constraints.join(', ')}</constraints>
        <scope>${intent.owned_scope.join(', ')}</scope>
      </intent_context>`;
    }
  }
}
