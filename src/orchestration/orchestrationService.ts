// src/orchestration/orchestrationService.ts

import { AgentCoordinator } from "./agentCoordinator";
import { KnowledgeManager } from "./knowledgeManager";

/**
 * OrchestrationService is responsible for managing the lifecycle of agents,
 * delegating tasks, and coordinating multi-agent execution flows.
 */
export class OrchestrationService {
  private coordinator: AgentCoordinator;
  private knowledgeManager: KnowledgeManager;

  constructor(coordinator: AgentCoordinator, knowledgeManager: KnowledgeManager) {
    this.coordinator = coordinator;
    this.knowledgeManager = knowledgeManager;
  }

  /**
   * Initializes a new orchestration session with the provided specification context.
   * @param specContext - Context extracted from SpecKit documents
   */
  async initializeSession(specContext: any) {
    await this.knowledgeManager.loadSpecification(specContext);
    this.coordinator.prepareAgents(specContext);
    console.log("[OrchestrationService] Session initialized.");
  }

  /**
   * Dispatches a high-level task to the agent coordinator for execution.
   * @param task - Task object or descriptor
   */
  async dispatchTask(task: any) {
    console.log(`[OrchestrationService] Dispatching task: ${task.name}`);
    const result = await this.coordinator.executeTask(task);
    return result;
  }

  /**
   * Retrieves the current state of the orchestration, including agent progress
   */
  getStatus() {
    return this.coordinator.getAgentStatus();
  }
}
