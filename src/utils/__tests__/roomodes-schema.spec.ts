import { describe, it, expect, beforeAll } from "vitest"
import Ajv from "ajv"
import * as fs from "fs"
import * as path from "path"

describe("roomodes JSON schema", () => {
	let ajv: Ajv
	let schema: Record<string, unknown>
	let validate: ReturnType<Ajv["compile"]>

	beforeAll(() => {
		const schemaPath = path.resolve(__dirname, "../../../schemas/roomodes.json")
		schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"))
		ajv = new Ajv({ strict: false })
		validate = ajv.compile(schema)
	})

	it("should be a valid JSON Schema", () => {
		expect(validate).toBeDefined()
	})

	it("should accept a minimal valid .roomodes config", () => {
		const config = {
			customModes: [
				{
					slug: "my-mode",
					name: "My Mode",
					roleDefinition: "You are a helpful assistant.",
					groups: ["read"],
				},
			],
		}

		const valid = validate(config)
		expect(validate.errors).toBeNull()
		expect(valid).toBe(true)
	})

	it("should accept a mode with all optional properties", () => {
		const config = {
			customModes: [
				{
					slug: "full-mode",
					name: "Full Mode",
					roleDefinition: "A complete mode definition.",
					whenToUse: "Use when you need everything.",
					description: "A mode with all properties.",
					customInstructions: "Follow these additional rules.",
					groups: ["read", "edit", "command", "mcp"],
					source: "project",
				},
			],
		}

		const valid = validate(config)
		expect(validate.errors).toBeNull()
		expect(valid).toBe(true)
	})

	it("should accept the built-in architect mode with tuple-style edit group", () => {
		const config = {
			customModes: [
				{
					slug: "architect",
					name: "Architect",
					roleDefinition: "You are an experienced technical leader.",
					whenToUse: "Use this mode when you need to plan.",
					description: "Plan and design before implementation",
					groups: ["read", ["edit", { fileRegex: "\\.md$", description: "Markdown files only" }], "mcp"],
					source: "project",
				},
			],
		}

		const valid = validate(config)
		expect(validate.errors).toBeNull()
		expect(valid).toBe(true)
	})

	it("should accept a tuple group entry with only fileRegex", () => {
		const config = {
			customModes: [
				{
					slug: "restricted",
					name: "Restricted",
					roleDefinition: "Limited editor.",
					groups: [["edit", { fileRegex: "\\.ts$" }]],
				},
			],
		}

		const valid = validate(config)
		expect(validate.errors).toBeNull()
		expect(valid).toBe(true)
	})

	it("should accept a tuple group entry with empty options", () => {
		const config = {
			customModes: [
				{
					slug: "empty-opts",
					name: "Empty Options",
					roleDefinition: "Mode with empty group options.",
					groups: [["edit", {}]],
				},
			],
		}

		const valid = validate(config)
		expect(validate.errors).toBeNull()
		expect(valid).toBe(true)
	})

	it("should accept the modes tool group", () => {
		const config = {
			customModes: [
				{
					slug: "orchestrator",
					name: "Orchestrator",
					roleDefinition: "You orchestrate other modes.",
					groups: ["read", "modes"],
				},
			],
		}

		const valid = validate(config)
		expect(validate.errors).toBeNull()
		expect(valid).toBe(true)
	})

	it("should reject a config missing customModes", () => {
		const config = {}

		const valid = validate(config)
		expect(valid).toBe(false)
	})

	it("should reject a mode missing required slug", () => {
		const config = {
			customModes: [
				{
					name: "No Slug",
					roleDefinition: "Missing slug.",
					groups: ["read"],
				},
			],
		}

		const valid = validate(config)
		expect(valid).toBe(false)
	})

	it("should reject a mode missing required groups", () => {
		const config = {
			customModes: [
				{
					slug: "no-groups",
					name: "No Groups",
					roleDefinition: "Missing groups.",
				},
			],
		}

		const valid = validate(config)
		expect(valid).toBe(false)
	})

	it("should reject a slug with invalid characters", () => {
		const config = {
			customModes: [
				{
					slug: "invalid slug!",
					name: "Bad Slug",
					roleDefinition: "Invalid slug characters.",
					groups: ["read"],
				},
			],
		}

		const valid = validate(config)
		expect(valid).toBe(false)
	})

	it("should reject an invalid tool group name", () => {
		const config = {
			customModes: [
				{
					slug: "bad-group",
					name: "Bad Group",
					roleDefinition: "Invalid group name.",
					groups: ["nonexistent"],
				},
			],
		}

		const valid = validate(config)
		expect(valid).toBe(false)
	})

	it("should reject additional properties on CustomMode", () => {
		const config = {
			customModes: [
				{
					slug: "extra-props",
					name: "Extra Props",
					roleDefinition: "Has extra properties.",
					groups: ["read"],
					unknownField: true,
				},
			],
		}

		const valid = validate(config)
		expect(valid).toBe(false)
	})

	it("should reject additional properties on GroupOptions", () => {
		const config = {
			customModes: [
				{
					slug: "bad-opts",
					name: "Bad Options",
					roleDefinition: "Extra options properties.",
					groups: [["edit", { fileRegex: "\\.md$", unknownOpt: true }]],
				},
			],
		}

		const valid = validate(config)
		expect(valid).toBe(false)
	})

	it("should reject a tuple with more than 2 elements", () => {
		const config = {
			customModes: [
				{
					slug: "big-tuple",
					name: "Big Tuple",
					roleDefinition: "Too many tuple elements.",
					groups: [["edit", { fileRegex: "\\.md$" }, "extra"]],
				},
			],
		}

		const valid = validate(config)
		expect(valid).toBe(false)
	})

	it("should reject an invalid source value", () => {
		const config = {
			customModes: [
				{
					slug: "bad-source",
					name: "Bad Source",
					roleDefinition: "Invalid source.",
					groups: ["read"],
					source: "unknown",
				},
			],
		}

		const valid = validate(config)
		expect(valid).toBe(false)
	})

	it("should accept an empty customModes array", () => {
		const config = {
			customModes: [],
		}

		const valid = validate(config)
		expect(validate.errors).toBeNull()
		expect(valid).toBe(true)
	})

	it("should accept multiple modes", () => {
		const config = {
			customModes: [
				{
					slug: "mode-a",
					name: "Mode A",
					roleDefinition: "First mode.",
					groups: ["read"],
				},
				{
					slug: "mode-b",
					name: "Mode B",
					roleDefinition: "Second mode.",
					groups: ["read", "edit"],
				},
			],
		}

		const valid = validate(config)
		expect(validate.errors).toBeNull()
		expect(valid).toBe(true)
	})
})
