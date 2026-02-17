import { describe, it, expect } from "vitest";
import { IntentLoader } from "../src/intent/intentLoader";

describe("IntentLoader", () => {
  it("should load intents correctly", async () => {
    const loader = new IntentLoader();
    const intents = await loader.loadIntents(".orchestration/active_intents.yaml");
    expect(intents).toBeDefined();
    expect(Array.isArray(intents)).toBe(true);
  });

  it("should throw an error for non-existent file", async () => {
    const loader = new IntentLoader();
    await expect(loader.loadIntents("nonexistent.yaml")).rejects.toThrow();
  });
});
