// src/intent/contextInjector.ts
import { Requirement } from './intentLoader';
import { IntentSelector } from './intentSelector';

export interface AgentContext {
  currentRequirement: Requirement | null;
  history: string[];
}

/**
 * ContextInjector handles pushing the active requirement
 * into the agent's context for deterministic code generation.
 */
export class ContextInjector {
  private selector: IntentSelector;
  private context: AgentContext;

  constructor(selector: IntentSelector) {
    this.selector = selector;
    this.context = {
      currentRequirement: this.selector.getCurrent(),
      history: [],
    };
  }

  /**
   * Injects the current requirement into the context
   * Can be called before any agent execution
   */
  public injectCurrent(): AgentContext {
    const currentReq = this.selector.getCurrent();
    this.context.currentRequirement = currentReq;
    return this.context;
  }

  /**
   * Adds a message or observation to the agent's context history
   */
  public addToHistory(message: string): void {
    this.context.history.push(message);
  }

  /**
   * Advances to the next requirement and updates context
   */
  public advance(): AgentContext | null {
    const nextReq = this.selector.next();
    if (nextReq) {
      this.context.currentRequirement = nextReq;
      return this.context;
    }
    return null;
  }

  /**
   * Retrieves the full context object
   */
  public getContext(): AgentContext {
    return this.context;
  }
}
