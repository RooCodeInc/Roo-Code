// src/orchestration/knowledgeManager.ts

import * as fs from "fs";
import * as path from "path";

/**
 * KnowledgeManager is responsible for loading, storing, and providing
 * access to specification documents, requirements, and project context.
 */
export class KnowledgeManager {
  private specContext: Record<string, any> = {};

  /**
   * Loads a specification from the given context or file path
   * @param specContext - Can be a parsed object or raw content
   */
  async loadSpecification(specContext: any) {
    // If specContext is a file path, read it
    if (typeof specContext === "string") {
      const fullPath = path.resolve(specContext);
      const raw = fs.readFileSync(fullPath, "utf-8");
      this.specContext = JSON.parse(raw);
    } else {
      this.specContext = specContext;
    }

    console.log("[KnowledgeManager] Specification loaded.");
  }

  /**
   * Retrieves a requirement or context entry by its unique ID
   * @param id - Requirement ID from SpecKit
   */
  getRequirement(id: string) {
    return this.specContext[id] || null;
  }

  /**
   * Returns the full loaded specification
   */
  getFullContext() {
    return this.specContext;
  }
}
