import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';
import { TraceLogger } from '../trace/traceLogger';

export type PromptContext = {
  sessionId?: string;
  user?: string;
  previousActions?: any[];
  [key: string]: any;
};

export type AgentPrompt = {
  id: string;
  intent: string;
  context: PromptContext;
  timestamp: string;
  promptText: string;
};

export class PromptBuilder {
  private traceLogger: TraceLogger;

  constructor() {
    this.traceLogger = new TraceLogger();
  }

  /**
   * Build a structured prompt from an intent
   * @param intent The user intent
   * @param context Optional additional context
   * @returns AgentPrompt object
   */
  buildPrompt(intent: string, context: PromptContext = {}): AgentPrompt {
    const sessionId = context.sessionId || uuidv4();
    const timestamp = new Date().toISOString();

    // Compose the natural language prompt
    const promptText = this.composePromptText(intent, context);

    const agentPrompt: AgentPrompt = {
      id: sessionId,
      intent,
      context: { ...context, sessionId },
      timestamp,
      promptText,
    };

    // Log to trace
    this.traceLogger.logPrompt(agentPrompt);

    Logger.info(`Prompt built for intent: ${intent}`);
    return agentPrompt;
  }

  /**
   * Compose the actual prompt text
   */
  private composePromptText(intent: string, context: PromptContext): string {
    let basePrompt = `Intent: ${intent}\n`;

    if (context.previousActions && context.previousActions.length > 0) {
      basePrompt += 'Previous Actions:\n';
      context.previousActions.forEach((action, idx) => {
        basePrompt += `${idx + 1}. ${JSON.stringify(action)}\n`;
      });
    }

    // Include optional metadata for agents/tools
    if (context.user) {
      basePrompt += `User: ${context.user}\n`;
    }

    return basePrompt.trim();
  }
}
