import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import * as yaml from "yaml"

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex")
}

function parseSpecMarkdown(md) {
  // Extremely small “SpecKit-like” parser: extracts the 4 sections we need.
  // Sections are identified by headings:
  // - "## Intent"
  // - "## Scope (owned_scope)"
  // - "## Constraints"
  // - "## Acceptance Criteria"
  const getSection = (title) => {
    const re = new RegExp(`^##\\s+${title}\\s*$`, "m")
    const m = md.match(re)
    if (!m) return ""
    const start = m.index + m[0].length
    const rest = md.slice(start)
    const next = rest.search(/^##\s+/m)
    return (next === -1 ? rest : rest.slice(0, next)).trim()
  }

  const intent = getSection("Intent").trim()
  const scope = getSection("Scope \\(owned_scope\\)")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim().replace(/^`|`$/g, ""))

  const constraints = getSection("Constraints")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())

  const acceptance = getSection("Acceptance Criteria")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())

  return { intent, scope, constraints, acceptance }
}

async function main() {
  const repoRoot = process.cwd()
  const specsDir = path.join(repoRoot, "specs")
  const orchestrationDir = path.join(repoRoot, ".orchestration")

  await fs.mkdir(specsDir, { recursive: true })
  await fs.mkdir(orchestrationDir, { recursive: true })

  const specFiles = (await fs.readdir(specsDir)).filter((f) => f.endsWith(".md"))
  if (specFiles.length === 0) {
    console.log("No spec files found in ./specs. Add at least one *.md spec and rerun.")
    process.exit(1)
  }

  const activeIntentsPath = path.join(orchestrationDir, "active_intents.yaml")
  const existingYaml = await fs.readFile(activeIntentsPath, "utf-8").catch(() => "active_intents: []\n")
  const existing = (yaml.parse(existingYaml) ?? {}) || {}
  const active_intents = Array.isArray(existing.active_intents) ? existing.active_intents : []

  for (const file of specFiles) {
    const full = path.join(specsDir, file)
    const md = await fs.readFile(full, "utf-8")

    const idMatch = file.match(/^(INT-\d+)/i)
    const id = idMatch ? idMatch[1].toUpperCase() : `INT-${sha256(file).slice(0, 3).toUpperCase()}`
    const name = md.split("\n").find((l) => l.startsWith("# "))?.replace(/^#\s+/, "").trim() || file

    const parsed = parseSpecMarkdown(md)

    const intentEntry = {
      id,
      name,
      status: "IN_PROGRESS",
      owned_scope: parsed.scope,
      constraints: parsed.constraints,
      acceptance_criteria: parsed.acceptance,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      spec_hash: `sha256:${sha256(md)}`,
      spec_file: `specs/${file}`,
    }

    const i = active_intents.findIndex((x) => x?.id === id)
    if (i >= 0) active_intents[i] = intentEntry
    else active_intents.push(intentEntry)
  }

  await fs.writeFile(activeIntentsPath, yaml.stringify({ active_intents }), "utf-8")
  console.log(`Updated .orchestration/active_intents.yaml with ${active_intents.length} intent(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


