import fs from "fs";
import path from "path";

const TRACE_FILE = path.resolve(".orchestration/agent_trace.jsonl");

function validateTrace() {
  if (!fs.existsSync(TRACE_FILE)) {
    console.error("agent_trace.jsonl does not exist. Run initOrchestration first.");
    process.exit(1);
  }

  const lines = fs.readFileSync(TRACE_FILE, "utf-8").split("\n").filter(Boolean);
  let validCount = 0;

  lines.forEach((line, index) => {
    try {
      JSON.parse(line);
      validCount++;
    } catch (err) {
      console.error(`Invalid JSON at line ${index + 1}`);
    }
  });

  console.log(`Validation complete: ${validCount}/${lines.length} lines are valid.`);
}

validateTrace();
