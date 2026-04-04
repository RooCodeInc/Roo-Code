#!/usr/bin/env node

const { zodToJsonSchema } = require("zod-to-json-schema")
const { mcpSettingsSchema } = require("../dist/mcp.js")
const fs = require("fs")
const path = require("path")

// Generate JSON schema from Zod schema
const jsonSchema = zodToJsonSchema(mcpSettingsSchema, "mcp-settings")

// Add schema metadata
jsonSchema.$schema = "http://json-schema.org/draft-07/schema#"
jsonSchema.title = "MCP Settings Schema"
jsonSchema.description = "Schema for Model Context Protocol server configuration in Jabberwock"

// Ensure the output directory exists
const outputDir = path.join(__dirname, "..", "schemas")
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// Write the schema to file
const outputPath = path.join(outputDir, "mcp-settings.schema.json")
fs.writeFileSync(outputPath, JSON.stringify(jsonSchema, null, 2))

console.log("✅ MCP settings JSON schema generated:", outputPath)