import { defineMatrix, it, describe } from "../src/runner/TestMatrixRunner"
import type { MatrixTestContext } from "../src/runner/types"

export default defineMatrix({
	variables: [
		{ api: "API_A", url: "https://api-a.test", region: "us-east" },
		{ api: "API_B", url: "https://api-b.test", region: "eu-west" },
		{ api: "API_C", url: "https://api-c.test", region: "asia-pac" },
	],
	iterations: 3,
	tests: () => {
		// First suite
		describe("API Health Checks", () => {
			it("should respond with status 200", async ({ variable, iteration }: MatrixTestContext) => {
				if (!variable.url.startsWith("https://")) throw new Error("Invalid URL")
			})
			it("should have a valid api name", ({ variable }: MatrixTestContext) => {
				if (!variable.api) throw new Error("Missing api name")
			})
			it("should include a valid region", ({ variable }: MatrixTestContext) => {
				if (!["us-east", "eu-west", "asia-pac"].includes(variable.region)) throw new Error("Unexpected region")
			})
		})
		// Second suite
		describe("Authentication", () => {
			it("should fail for no token", async ({ variable }: MatrixTestContext) => {
				if (variable.api === "API_B") throw new Error("No token failure")
			})
			it("should pass with valid token", async ({ variable }: MatrixTestContext) => {
				if (!variable.url.includes("api-")) throw new Error("No api in URL")
			})
			it("should region match policy", ({ variable }: MatrixTestContext) => {
				if (variable.region === "asia-pac" && variable.api !== "API_C") throw new Error("policy fail")
			})
		})
		// Third suite
		describe("Data validation", () => {
			it("should have url with a dot", ({ variable }: MatrixTestContext) => {
				if (!variable.url.includes(".")) throw new Error("URL missing dot")
			})
			it("api name upper-case only", ({ variable }: MatrixTestContext) => {
				if (!/^[A-Z_]+$/.test(variable.api)) throw new Error("API name format")
			})
			it("region code format", ({ variable }: MatrixTestContext) => {
				if (!variable.region.includes("-")) throw new Error("Bad region code")
			})
		})
	},
})
