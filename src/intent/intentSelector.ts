// src/intent/intentSelector.ts
import { Requirement } from './intentLoader';

export class IntentSelector {
  private requirements: Requirement[];
  private currentIndex: number;

  constructor(requirements: Requirement[]) {
    this.requirements = requirements;
    this.currentIndex = 0; // start at first requirement by default
  }

  /**
   * Returns the currently active requirement
   */
  public getCurrent(): Requirement | null {
    if (this.requirements.length === 0) return null;
    return this.requirements[this.currentIndex];
  }

  /**
   * Moves to the next requirement in the list
   */
  public next(): Requirement | null {
    if (this.currentIndex < this.requirements.length - 1) {
      this.currentIndex++;
      return this.requirements[this.currentIndex];
    }
    return null; // no more requirements
  }

  /**
   * Moves to a specific requirement by ID
   */
  public selectById(id: string): Requirement | null {
    const index = this.requirements.findIndex(req => req.id === id);
    if (index >= 0) {
      this.currentIndex = index;
      return this.requirements[this.currentIndex];
    }
    return null; // not found
  }

  /**
   * Returns all pending requirements
   */
  public getPending(): Requirement[] {
    return this.requirements.slice(this.currentIndex + 1);
  }
}
