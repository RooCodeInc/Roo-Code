import { describe, it, expect, vi } from "vitest";
import { HookEngine } from "../src/hooks/hookEngine";

describe("HookEngine", () => {
  it("should instantiate without errors", () => {
    const hookEngine = new HookEngine();
    expect(hookEngine).toBeInstanceOf(HookEngine);
  });

  it("should register a preToolUse hook", () => {
    const hookEngine = new HookEngine();
    const mockHook = vi.fn();
    hookEngine.registerPreToolUse(mockHook);
    expect(hookEngine.preHooks.length).toBe(1);
  });

  it("should register a postToolUse hook", () => {
    const hookEngine = new HookEngine();
    const mockHook = vi.fn();
    hookEngine.registerPostToolUse(mockHook);
    expect(hookEngine.postHooks.length).toBe(1);
  });
});
