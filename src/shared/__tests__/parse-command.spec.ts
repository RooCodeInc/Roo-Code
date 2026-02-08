// npx vitest run src/shared/__tests__/parse-command.spec.ts

import { describe, it, expect } from "vitest"
import { validateCommandQuotes } from "../parse-command"

describe("validateCommandQuotes", () => {
	describe("valid commands", () => {
		it("should accept empty or whitespace-only commands", () => {
			expect(validateCommandQuotes("")).toEqual({ valid: true })
			expect(validateCommandQuotes("   ")).toEqual({ valid: true })
			expect(validateCommandQuotes("\t\n")).toEqual({ valid: true })
		})

		it("should accept commands without quotes", () => {
			expect(validateCommandQuotes("echo hello")).toEqual({ valid: true })
			expect(validateCommandQuotes("ls -la")).toEqual({ valid: true })
			expect(validateCommandQuotes("npm install")).toEqual({ valid: true })
		})

		it("should accept commands with balanced double quotes", () => {
			expect(validateCommandQuotes('echo "hello world"')).toEqual({ valid: true })
			expect(validateCommandQuotes('echo "hello" && echo "world"')).toEqual({ valid: true })
			expect(validateCommandQuotes('cat "file with spaces.txt"')).toEqual({ valid: true })
		})

		it("should accept commands with balanced single quotes", () => {
			expect(validateCommandQuotes("echo 'hello world'")).toEqual({ valid: true })
			expect(validateCommandQuotes("echo 'hello' && echo 'world'")).toEqual({ valid: true })
			expect(validateCommandQuotes("cat 'file with spaces.txt'")).toEqual({ valid: true })
		})

		it("should accept commands with mixed balanced quotes", () => {
			expect(validateCommandQuotes(`echo "it's working"`)).toEqual({ valid: true })
			expect(validateCommandQuotes(`echo 'say "hello"'`)).toEqual({ valid: true })
			expect(validateCommandQuotes(`git commit -m "it's a 'test'"`)).toEqual({ valid: true })
		})

		it("should accept commands with escaped double quotes", () => {
			expect(validateCommandQuotes('echo "hello \\"world\\""')).toEqual({ valid: true })
			expect(validateCommandQuotes('echo "test \\"nested\\" value"')).toEqual({ valid: true })
		})

		it("should accept heredoc syntax", () => {
			expect(validateCommandQuotes("cat <<EOF")).toEqual({ valid: true })
			expect(validateCommandQuotes("cat <<-EOF")).toEqual({ valid: true })
			expect(validateCommandQuotes("cat <<'EOF'")).toEqual({ valid: true })
			expect(validateCommandQuotes('cat <<"EOF"')).toEqual({ valid: true })
			expect(validateCommandQuotes("cat << EOF")).toEqual({ valid: true })
			expect(validateCommandQuotes("cat <<MARKER")).toEqual({ valid: true })
		})

		it("should accept ANSI-C quoting", () => {
			expect(validateCommandQuotes("echo $'hello\\nworld'")).toEqual({ valid: true })
			expect(validateCommandQuotes("echo $'tab\\there'")).toEqual({ valid: true })
		})

		it("should accept complex real-world commands", () => {
			expect(validateCommandQuotes('git log --oneline --format="%h %s"')).toEqual({ valid: true })
			expect(validateCommandQuotes("find . -name '*.ts' -exec cat {} \\;")).toEqual({ valid: true })
			expect(validateCommandQuotes('docker run -e "VAR=value" image')).toEqual({ valid: true })
			expect(validateCommandQuotes("ssh user@host 'ls -la'")).toEqual({ valid: true })
		})
	})

	describe("invalid commands with unbalanced quotes", () => {
		it("should detect unbalanced double quotes at the start", () => {
			const result = validateCommandQuotes('echo "hello')
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.quoteType).toBe("double")
				expect(result.position).toBe(5)
			}
		})

		it("should detect unbalanced double quotes in the middle", () => {
			const result = validateCommandQuotes('echo hello && cat "file.txt')
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.quoteType).toBe("double")
			}
		})

		it("should detect unbalanced single quotes at the start", () => {
			const result = validateCommandQuotes("echo 'hello")
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.quoteType).toBe("single")
				expect(result.position).toBe(5)
			}
		})

		it("should detect unbalanced single quotes in the middle", () => {
			const result = validateCommandQuotes("echo hello && cat 'file.txt")
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.quoteType).toBe("single")
			}
		})

		it("should detect odd number of double quotes", () => {
			const result = validateCommandQuotes('echo "hello" "world')
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.quoteType).toBe("double")
			}
		})

		it("should detect odd number of single quotes", () => {
			const result = validateCommandQuotes("echo 'hello' 'world")
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.quoteType).toBe("single")
			}
		})

		it("should provide context in error result", () => {
			const result = validateCommandQuotes('echo "hello world')
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.context).toContain('"')
				expect(result.context.length).toBeLessThanOrEqual(30) // Context is bounded
			}
		})
	})

	describe("edge cases", () => {
		it("should handle quotes at the very end of command", () => {
			const result = validateCommandQuotes('echo test"')
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.quoteType).toBe("double")
			}
		})

		it("should handle consecutive quotes", () => {
			expect(validateCommandQuotes('echo ""')).toEqual({ valid: true })
			expect(validateCommandQuotes("echo ''")).toEqual({ valid: true })
			expect(validateCommandQuotes(`echo """"""`)).toEqual({ valid: true }) // Three pairs
		})

		it("should handle backslash escaping the closing quote (unbalanced)", () => {
			// In shell, \" escapes the quote, so echo "test\" is unbalanced
			// The string `echo "test\"` has an escaped quote, leaving it unclosed
			const result = validateCommandQuotes('echo "test\\"')
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.quoteType).toBe("double")
			}
		})

		it("should handle literal backslash followed by closing quote (balanced)", () => {
			// To have a backslash at the end of a quoted string, you need \\"
			// In shell: echo "test\\" means content is "test\" (backslash at end)
			// In JS: 'echo "test\\\\"' represents the shell command: echo "test\\"
			expect(validateCommandQuotes('echo "test\\\\"')).toEqual({ valid: true })
		})

		it("should handle single quote in double quoted string (valid)", () => {
			expect(validateCommandQuotes(`echo "it's fine"`)).toEqual({ valid: true })
		})

		it("should handle double quote in single quoted string (valid)", () => {
			expect(validateCommandQuotes(`echo 'say "hi"'`)).toEqual({ valid: true })
		})

		it("should handle escaped single quote outside of quotes", () => {
			expect(validateCommandQuotes("echo it\\'s")).toEqual({ valid: true })
		})

		it("should handle multiple unbalanced - reports first one", () => {
			// If both quote types are unbalanced, we find whichever starts first
			const result = validateCommandQuotes(`echo "hello 'world`)
			expect(result.valid).toBe(false)
			// Double quote at position 5 starts before single quote at position 12
			if (!result.valid) {
				expect(result.quoteType).toBe("double")
			}
		})
	})

	describe("shell-specific patterns", () => {
		it("should accept bash variable substitution in quotes", () => {
			expect(validateCommandQuotes('echo "$HOME/path"')).toEqual({ valid: true })
			expect(validateCommandQuotes('echo "${VAR:-default}"')).toEqual({ valid: true })
		})

		it("should accept command substitution in quotes", () => {
			expect(validateCommandQuotes('echo "Today is $(date)"')).toEqual({ valid: true })
			expect(validateCommandQuotes("echo 'Date: $(date)'")).toEqual({ valid: true })
		})

		it("should handle PowerShell style quotes", () => {
			expect(validateCommandQuotes('Write-Output "Hello World"')).toEqual({ valid: true })
			expect(validateCommandQuotes("Write-Output 'Hello World'")).toEqual({ valid: true })
		})
	})
})
