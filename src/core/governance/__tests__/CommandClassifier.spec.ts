import { classifyCommand, isDestructiveCommand } from "../CommandClassifier"

describe("CommandClassifier", () => {
	it("classifies read_file as safe", () => {
		expect(classifyCommand("read_file")).toBe("safe")
		expect(isDestructiveCommand("read_file")).toBe(false)
	})

	it("classifies write_to_file as destructive", () => {
		expect(classifyCommand("write_to_file")).toBe("destructive")
		expect(isDestructiveCommand("write_to_file")).toBe(true)
	})

	it("classifies execute_command as destructive", () => {
		expect(classifyCommand("execute_command")).toBe("destructive")
	})
})
