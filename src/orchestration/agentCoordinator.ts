// src/orchestration/agentCoordinator.ts

/**
 * AgentCoordinator manages agent registration,
 * task delegation, and execution tracking.
 */

export interface Agent {
  id: string;
  role: string;
  execute(task: any): Promise<any>;
}

export class AgentCoordinator {
  private agents: Map<string, Agent> = new Map();
  private status: Record<string, string> = {};

  /**
   * Registers an agent to the system
   */
  registerAgent(agent: Agent) {
    this.agents.set(agent.id, agent);
    this.status[agent.id] = "idle";
  }

  /**
   * Prepares agents using specification context
   */
  prepareAgents(specContext: any) {
    console.log("[AgentCoordinator] Preparing agents with spec context...");
    // In a real implementation this could configure tools, prompts, permissions, etc.
  }

  /**
   * Executes a task by selecting an available agent
   */
  async executeTask(task: any) {
    const availableAgent = [...this.agents.values()].find(
      (agent) => this.status[agent.id] === "idle"
    );

    if (!availableAgent) {
      throw new Error("No available agents to execute the task.");
    }

    this.status[availableAgent.id] = "busy";

    try {
      const result = await availableAgent.execute(task);
      this.status[availableAgent.id] = "idle";
      return result;
    } catch (error) {
      this.status[availableAgent.id] = "error";
      throw error;
    }
  }

  /**
   * Returns status of all agents
   */
  getAgentStatus() {
    return this.status;
  }
}
