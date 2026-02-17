import fs from "fs";
import path from "path";

const ORCHESTRATION_DIR = path.resolve(".orchestration");

function initOrchestration() {
  if (!fs.existsSync(ORCHESTRATION_DIR)) {
    fs.mkdirSync(ORCHESTRATION_DIR);
    console.log(".orchestration folder created.");
  }

  // Create starter files if missing
  const files = [
    "active_intents.yaml",
    "agent_trace.jsonl",
    "intent_map.md",
    "CLAUDE.md",
    "system_state.json",
  ];

  files.forEach((file) => {
    const filePath = path.join(ORCHESTRATION_DIR, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "");
      console.log(`Created ${file}`);
    }
  });

  console.log("Orchestration initialization complete.");
}

initOrchestration();
