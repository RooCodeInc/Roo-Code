import { containsDangerousSubstitution, getCommandDecision } from "../commands"

describe("containsDangerousSubstitution()", () => {
	it("does not flag Python assignment grouping '=(' inside heredoc content", () => {
		const cmd = [
			"python - <<'PY'",
			"import json, pathlib",
			"data = {'notes': ''}",
			"data['notes']=(data.get('notes','')+'; policy set to linked-only by user').lstrip('; ')",
			"print(data['notes'])",
			"PY",
		].join("\n")

		expect(containsDangerousSubstitution(cmd)).toBe(false)
	})

	it("does not flag simple assignment grouping pattern x=(...)", () => {
		expect(containsDangerousSubstitution("x=(1+2)")).toBe(false)
	})

	it("does flag zsh process substitution when used as an argument", () => {
		expect(containsDangerousSubstitution("cat =(echo hi)")).toBe(true)
	})
})

describe("getCommandDecision()", () => {
	it("auto-approves allowed heredoc command when no dangerous substitution is present", () => {
		const cmd = ["python - <<'PY'", "x=(1+2)", "print(x)", "PY"].join("\n")

		expect(getCommandDecision(cmd, ["python"], [])).toBe("auto_approve")
	})
})
