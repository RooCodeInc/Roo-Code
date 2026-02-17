import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { TraceLogger } from "../src/trace/traceLogger";

const TRACE_FILE = path.resolve(".orchestration/agent_trace.jsonl");

describe("TraceLogger", () => {
  beforeEach(() => {
    if (fs.existsSync(TRACE_FILE)) fs.unlinkSync(TRACE_FILE);
  });

  afterEach(() => {
    if (fs.existsSync(TRACE_FILE)) fs.unlinkSync(TRACE_FILE);
  });

  it("should append a trace record to the JSONL file", () => {
    const logger = new TraceLogger();
    const record = { id: "test1", content: "dummy code block" };
    logger.log(record);

    const content = fs.readFileSync(TRACE_FILE, "utf-8").trim();
    expect(content).toContain("test1");
    expect(content).toContain("dummy code block");
  });
});
