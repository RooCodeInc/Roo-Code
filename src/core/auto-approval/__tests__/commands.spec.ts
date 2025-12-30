import {
	findLongestPrefixMatch,
	getCommandDecision,
	getSingleCommandDecision,
	isAutoApprovedSingleCommand,
	isAutoDeniedSingleCommand,
	containsDangerousSubstitution,
} from "../commands"

describe("commands auto-approval", () => {
	describe("containsDangerousSubstitution", () => {
		it("should detect dangerous parameter expansion @P", () => {
			expect(containsDangerousSubstitution('echo "${var@P}"')).toBe(true)
		})

		it("should detect dangerous parameter expansion @Q, @E, @A, @a", () => {
			expect(containsDangerousSubstitution('echo "${var@Q}"')).toBe(true)
			expect(containsDangerousSubstitution('echo "${var@E}"')).toBe(true)
			expect(containsDangerousSubstitution('echo "${var@A}"')).toBe(true)
			expect(containsDangerousSubstitution('echo "${var@a}"')).toBe(true)
		})

		it("should detect indirect variable references", () => {
			expect(containsDangerousSubstitution('echo "${!var}"')).toBe(true)
		})

		it("should detect here-strings with command substitution", () => {
			expect(containsDangerousSubstitution("cat <<<$(whoami)")).toBe(true)
			expect(containsDangerousSubstitution("cat <<<`whoami`")).toBe(true)
		})

		it("should detect zsh process substitution", () => {
			expect(containsDangerousSubstitution("cat =(whoami)")).toBe(true)
		})

		it("should detect zsh glob qualifiers with code execution", () => {
			expect(containsDangerousSubstitution("*(e:whoami:)")).toBe(true)
			expect(containsDangerousSubstitution("?(e:rm -rf /:)")).toBe(true)
		})

		it("should not flag safe commands", () => {
			expect(containsDangerousSubstitution("echo hello")).toBe(false)
			expect(containsDangerousSubstitution('echo "$HOME"')).toBe(false)
			expect(containsDangerousSubstitution('echo "${PATH}"')).toBe(false)
			expect(containsDangerousSubstitution("git add -A")).toBe(false)
		})

		it("should detect octal escape sequences in parameter assignments", () => {
			expect(containsDangerousSubstitution('echo "${var=\\140whoami\\140}"')).toBe(true)
		})
	})

	describe("findLongestPrefixMatch", () => {
		it("should match git add -A with git add prefix", () => {
			expect(findLongestPrefixMatch("git add -A", ["git add"])).toBe("git add")
		})

		it("should match git add -A with git prefix", () => {
			expect(findLongestPrefixMatch("git add -A", ["git"])).toBe("git")
		})

		it("should return longer prefix when multiple match", () => {
			expect(findLongestPrefixMatch("git add -A", ["git", "git add"])).toBe("git add")
		})

		it("should be case insensitive", () => {
			expect(findLongestPrefixMatch("GIT ADD -A", ["git add"])).toBe("git add")
			expect(findLongestPrefixMatch("git add -A", ["GIT ADD"])).toBe("git add")
		})

		it("should return null when no match", () => {
			expect(findLongestPrefixMatch("npm install", ["git add"])).toBeNull()
		})

		it("should handle wildcard", () => {
			expect(findLongestPrefixMatch("any command", ["*"])).toBe("*")
		})

		it("should return null for empty command", () => {
			expect(findLongestPrefixMatch("", ["git"])).toBeNull()
		})

		it("should return null for empty prefix list", () => {
			expect(findLongestPrefixMatch("git add", [])).toBeNull()
		})

		it("should handle commands with leading/trailing whitespace", () => {
			expect(findLongestPrefixMatch("  git add -A  ", ["git add"])).toBe("git add")
		})

		it("should prefer specific match over wildcard", () => {
			expect(findLongestPrefixMatch("git add", ["*", "git"])).toBe("git")
		})
	})

	describe("getSingleCommandDecision", () => {
		it("should auto-approve git add -A when git add is allowed", () => {
			expect(getSingleCommandDecision("git add -A", ["git add"], [])).toBe("auto_approve")
		})

		it("should auto-approve git add . when git add is allowed", () => {
			expect(getSingleCommandDecision("git add .", ["git add"], [])).toBe("auto_approve")
		})

		it("should auto-approve git commit with message when git commit is allowed", () => {
			expect(getSingleCommandDecision('git commit -m "test"', ["git commit"], [])).toBe("auto_approve")
		})

		it("should ask user when command does not match any allowed prefix", () => {
			expect(getSingleCommandDecision("npm install", ["git add"], [])).toBe("ask_user")
		})

		it("should auto-deny when command matches denied prefix", () => {
			expect(getSingleCommandDecision("rm -rf /", [], ["rm"])).toBe("auto_deny")
		})

		it("should auto-deny when denied prefix is longer than allowed prefix", () => {
			// Allowed: "git", Denied: "git push" - git push should be denied
			expect(getSingleCommandDecision("git push origin main", ["git"], ["git push"])).toBe("auto_deny")
		})

		it("should auto-approve when allowed prefix is longer than denied prefix", () => {
			// Allowed: "git push --dry-run", Denied: "git push" - dry-run should be allowed
			expect(getSingleCommandDecision("git push --dry-run", ["git push --dry-run"], ["git push"])).toBe(
				"auto_approve",
			)
		})

		it("should auto-approve empty command", () => {
			expect(getSingleCommandDecision("", ["git"], [])).toBe("auto_approve")
		})
	})

	describe("isAutoApprovedSingleCommand", () => {
		it("should approve git add -A when git add is in allowed list", () => {
			expect(isAutoApprovedSingleCommand("git add -A", ["git add"])).toBe(true)
		})

		it("should approve git add with just git in allowed list", () => {
			expect(isAutoApprovedSingleCommand("git add -A", ["git"])).toBe(true)
		})

		it("should not approve when no match", () => {
			expect(isAutoApprovedSingleCommand("npm install", ["git add"])).toBe(false)
		})

		it("should approve empty command", () => {
			expect(isAutoApprovedSingleCommand("", ["git"])).toBe(true)
		})

		it("should not approve when allowed list is empty", () => {
			expect(isAutoApprovedSingleCommand("git add", [])).toBe(false)
		})

		it("should approve any command with wildcard in allowed list", () => {
			expect(isAutoApprovedSingleCommand("any command here", ["*"])).toBe(true)
		})

		it("should use denylist to override allowlist", () => {
			expect(isAutoApprovedSingleCommand("rm -rf", ["*"], ["rm"])).toBe(false)
		})
	})

	describe("isAutoDeniedSingleCommand", () => {
		it("should deny rm commands when rm is in denied list", () => {
			expect(isAutoDeniedSingleCommand("rm -rf /", [], ["rm"])).toBe(true)
		})

		it("should not deny when no denied list match", () => {
			expect(isAutoDeniedSingleCommand("git add", [], ["rm"])).toBe(false)
		})

		it("should not deny when allowed prefix is longer", () => {
			expect(isAutoDeniedSingleCommand("git push --dry-run", ["git push --dry-run"], ["git push"])).toBe(false)
		})

		it("should deny when denied prefix is longer than or equal to allowed", () => {
			expect(isAutoDeniedSingleCommand("git push", ["git"], ["git push"])).toBe(true)
		})

		it("should not deny empty command", () => {
			expect(isAutoDeniedSingleCommand("", [], ["rm"])).toBe(false)
		})

		it("should not deny when denied list is empty", () => {
			expect(isAutoDeniedSingleCommand("rm -rf", [], [])).toBe(false)
		})
	})

	describe("getCommandDecision", () => {
		it("should auto-approve simple git add -A command", () => {
			expect(getCommandDecision("git add -A", ["git add"], [])).toBe("auto_approve")
		})

		it("should auto-approve git add with various flags", () => {
			expect(getCommandDecision("git add --all", ["git add"], [])).toBe("auto_approve")
			expect(getCommandDecision("git add -u", ["git add"], [])).toBe("auto_approve")
			expect(getCommandDecision("git add .", ["git add"], [])).toBe("auto_approve")
			expect(getCommandDecision("git add -p", ["git add"], [])).toBe("auto_approve")
		})

		// Note: This test documents issue #10226 - multiline quoted strings are not auto-approved
		// PR #10228 adds joinQuotedLines() to fix this issue
		it.skip("should auto-approve multiline git commit (blocked by #10226)", () => {
			const multilineCommand = `git commit -m "feat: add feature

This is a detailed description
with multiple lines"`
			expect(getCommandDecision(multilineCommand, ["git commit"], [])).toBe("auto_approve")
		})

		it("should handle command chains with all allowed commands", () => {
			expect(getCommandDecision("git add . && git commit -m 'test'", ["git add", "git commit"], [])).toBe(
				"auto_approve",
			)
		})

		it("should ask user when any chained command is not allowed", () => {
			expect(getCommandDecision("git add . && npm install", ["git add"], [])).toBe("ask_user")
		})

		it("should auto-deny when any chained command is denied", () => {
			expect(getCommandDecision("git add . && rm -rf /", ["git add"], ["rm"])).toBe("auto_deny")
		})

		it("should auto-approve empty string", () => {
			expect(getCommandDecision("", ["git"], [])).toBe("auto_approve")
		})

		it("should auto-approve whitespace-only string", () => {
			expect(getCommandDecision("   ", ["git"], [])).toBe("auto_approve")
		})

		it("should ask user for commands with dangerous substitutions even if allowed", () => {
			expect(getCommandDecision('echo "${var@P}"', ["echo"], [])).toBe("ask_user")
		})

		it("should handle pipe chains", () => {
			expect(getCommandDecision("cat file.txt | grep pattern", ["cat", "grep"], [])).toBe("auto_approve")
		})

		it("should handle semicolon chains", () => {
			expect(getCommandDecision("echo hello; echo world", ["echo"], [])).toBe("auto_approve")
		})

		it("should handle or chains", () => {
			expect(getCommandDecision("npm test || echo failed", ["npm test", "echo"], [])).toBe("auto_approve")
		})

		it("should handle background operator", () => {
			expect(getCommandDecision("npm run build &", ["npm run"], [])).toBe("auto_approve")
		})

		it("should handle commands with redirections", () => {
			expect(getCommandDecision("echo hello > file.txt", ["echo"], [])).toBe("auto_approve")
		})

		it("should handle commands with PowerShell-style redirections", () => {
			expect(getCommandDecision("npm install 2>&1", ["npm install"], [])).toBe("auto_approve")
		})
	})

	describe("real-world scenarios from issue #10226", () => {
		it("should auto-approve git add with -A flag when git add is allowed", () => {
			// User report: "git add -A will not auto-run with just git add auto-approved"
			// This test confirms the expected behavior works
			expect(getCommandDecision("git add -A", ["git add"], [])).toBe("auto_approve")
		})

		it("should auto-approve git commit with single-line message", () => {
			expect(getCommandDecision('git commit -m "fix: bug fix"', ["git commit"], [])).toBe("auto_approve")
		})

		it("should auto-approve bd create with single-line description", () => {
			expect(getCommandDecision('bd create "simple description"', ["bd create"], [])).toBe("auto_approve")
		})

		it("should handle case-insensitive prefix matching", () => {
			expect(getCommandDecision("GIT ADD -A", ["git add"], [])).toBe("auto_approve")
			expect(getCommandDecision("Git Add -A", ["git add"], [])).toBe("auto_approve")
		})
	})
})
