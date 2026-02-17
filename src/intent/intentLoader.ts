// src/intent/intentLoader.ts
import * as fs from 'fs';
import * as path from 'path';

export interface Requirement {
  id: string;
  title: string;
  description: string;
}

export class IntentLoader {
  private specDir: string;

  constructor(workspaceRoot: string) {
    this.specDir = path.join(workspaceRoot, '.specify');
  }

  /**
   * Loads all markdown specification files in the .specify folder
   */
  public loadAll(): Requirement[] {
    if (!fs.existsSync(this.specDir)) return [];

    const files = fs.readdirSync(this.specDir).filter(f => f.endsWith('.md'));
    const requirements: Requirement[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(this.specDir, file), 'utf-8');
      const parsed = this.parseMarkdown(content);
      requirements.push(...parsed);
    }

    return requirements;
  }

  /**
   * Parses markdown content to extract requirement IDs and descriptions
   */
  private parseMarkdown(content: string): Requirement[] {
    const lines = content.split('\n');
    const requirements: Requirement[] = [];

    let currentReq: Requirement | null = null;

    for (const line of lines) {
      const match = line.match(/^##\s+\[([A-Za-z0-9_-]+)\]\s+(.*)$/); // e.g., ## [REQ-1] User login
      if (match) {
        if (currentReq) requirements.push(currentReq);
        currentReq = {
          id: match[1],
          title: match[2],
          description: ''
        };
      } else if (currentReq) {
        currentReq.description += line + '\n';
      }
    }

    if (currentReq) requirements.push(currentReq);
    return requirements;
  }
}
