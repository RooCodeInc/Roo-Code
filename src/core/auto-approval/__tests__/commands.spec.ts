import {
	containsShellFileRedirection,
	containsBackgroundOperator,
	containsDangerousSubstitution,
	getCommandDecision,
	getSingleCommandDecision,
	findLongestPrefixMatch,
} from "../commands"

// ---------------------------------------------------------------------------
// Hannes's tests: zsh false-positive regressions (#11365, #11382)
// ---------------------------------------------------------------------------

describe("containsDangerousSubstitution", () => {
	describe("zsh array assignments (should NOT be flagged)", () => {
		it("should return false for files=(a b c)", () => {
			expect(containsDangerousSubstitution("files=(a b c)")).toBe(false)
		})

		it("should return false for var=(item1 item2)", () => {
			expect(containsDangerousSubstitution("var=(item1 item2)")).toBe(false)
		})

		it("should return false for x=(hello)", () => {
			expect(containsDangerousSubstitution("x=(hello)")).toBe(false)
		})
	})

	describe("zsh process substitution (should be flagged)", () => {
		it("should return true for standalone =(whoami)", () => {
			expect(containsDangerousSubstitution("=(whoami)")).toBe(true)
		})

		it("should return true for =(ls) with leading space", () => {
			expect(containsDangerousSubstitution(" =(ls)")).toBe(true)
		})

		it("should return true for echo =(cat /etc/passwd)", () => {
			expect(containsDangerousSubstitution("echo =(cat /etc/passwd)")).toBe(true)
		})
	})
})

describe("getCommandDecision", () => {
	it("should auto_approve array assignment command with wildcard allowlist", () => {
		const command = 'files=(a.ts b.ts); for f in "${files[@]}"; do echo "$f"; done'
		const result = getCommandDecision(command, ["*"])
		expect(result).toBe("auto_approve")
	})
})

describe("containsDangerousSubstitution — node -e one-liner false positive regression", () => {
	const nodeOneLiner = `node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('prd.json','utf8'));const allowed=new Set(['pending','in-progress','complete','blocked']);const bad=(p.items||[]).filter(i=>!allowed.has(i.status));console.log('meta.status',p.meta?.status);console.log('workstreams', (p.workstreams||[]).length);console.log('items', (p.items||[]).length);console.log('statusCounts', (p.items||[]).reduce((a,i)=>(a[i.status]=(a[i.status]||0)+1,a),{}));console.log('invalidStatuses', bad.length);if(bad.length){console.log(bad.map(i=>i.id+':'+i.status).join('\\\\n'));process.exit(2);} "`

	it("should NOT flag the complex node -e one-liner as dangerous substitution", () => {
		expect(containsDangerousSubstitution(nodeOneLiner)).toBe(false)
	})
})

describe("containsDangerousSubstitution — arrow function patterns (should NOT be flagged)", () => {
	it("should return false for node -e with simple arrow function", () => {
		expect(containsDangerousSubstitution(`node -e "const a=(b)=>b"`)).toBe(false)
	})

	it("should return false for node -e with spaced arrow function", () => {
		expect(containsDangerousSubstitution(`node -e "const fn = (x) => x * 2"`)).toBe(false)
	})

	it("should return false for node -e with arrow function in method chain", () => {
		expect(containsDangerousSubstitution(`node -e "arr.filter(i=>!set.has(i))"`)).toBe(false)
	})
})

describe("containsDangerousSubstitution — true positives still caught", () => {
	it("should flag dangerous parameter expansion ${var@P}", () => {
		expect(containsDangerousSubstitution('echo "${var@P}"')).toBe(true)
	})

	it("should flag here-string with command substitution <<<$(…)", () => {
		expect(containsDangerousSubstitution("cat <<<$(whoami)")).toBe(true)
	})

	it("should flag indirect variable reference ${!var}", () => {
		expect(containsDangerousSubstitution("echo ${!prefix}")).toBe(true)
	})

	it("should flag zsh process substitution =(…) at start of token", () => {
		expect(containsDangerousSubstitution("echo =(cat /etc/passwd)")).toBe(true)
	})

	it("should flag zsh glob qualifier with code execution", () => {
		expect(containsDangerousSubstitution("ls *(e:whoami:)")).toBe(true)
	})
})

describe("getCommandDecision — integration with dangerous substitution checks", () => {
	const allowedCommands = ["node", "echo"]

	it("should auto-approve the complex node -e one-liner when node is allowed", () => {
		const nodeOneLiner = `node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('prd.json','utf8'));const allowed=new Set(['pending','in-progress','complete','blocked']);const bad=(p.items||[]).filter(i=>!allowed.has(i.status));console.log('meta.status',p.meta?.status);console.log('workstreams', (p.workstreams||[]).length);console.log('items', (p.items||[]).length);console.log('statusCounts', (p.items||[]).reduce((a,i)=>(a[i.status]=(a[i.status]||0)+1,a),{}));console.log('invalidStatuses', bad.length);if(bad.length){console.log(bad.map(i=>i.id+':'+i.status).join('\\\\n'));process.exit(2);} "`

		expect(getCommandDecision(nodeOneLiner, allowedCommands)).toBe("auto_approve")
	})

	it("should ask user for echo $(whoami) because subshell whoami is not in the allowlist", () => {
		expect(getCommandDecision("echo $(whoami)", allowedCommands)).toBe("ask_user")
	})

	it("should ask user for dangerous parameter expansion even when command is allowed", () => {
		expect(getCommandDecision('echo "${var@P}"', allowedCommands)).toBe("ask_user")
	})
})

// ---------------------------------------------------------------------------
// Shell redirection & background operator detection (#11367)
// ---------------------------------------------------------------------------

describe("containsShellFileRedirection", () => {
	// Should detect file redirection
	it("detects output redirection >", () => {
		expect(containsShellFileRedirection("git show > out.txt")).toBe(true)
	})

	it("detects append redirection >>", () => {
		expect(containsShellFileRedirection("git show >> out.txt")).toBe(true)
	})

	it("detects input redirection <", () => {
		expect(containsShellFileRedirection("cat < in.txt")).toBe(true)
	})

	it("detects here-document <<", () => {
		expect(containsShellFileRedirection("cat << EOF")).toBe(true)
	})

	it("detects redirection to sensitive path", () => {
		expect(containsShellFileRedirection("git show > ~/.ssh/id_rsa")).toBe(true)
	})

	it("detects &> (bash stdout+stderr redirection)", () => {
		expect(containsShellFileRedirection("cmd &> out.txt")).toBe(true)
	})

	it("detects >&file (shell redirection to file)", () => {
		expect(containsShellFileRedirection("cmd >&out.txt")).toBe(true)
	})

	it("detects 2> (stderr to file)", () => {
		expect(containsShellFileRedirection("cmd 2> err.log")).toBe(true)
	})

	// Should NOT detect safe fd-to-fd redirections
	it("does not flag 2>&1 (fd-to-fd)", () => {
		expect(containsShellFileRedirection("git show 2>&1")).toBe(false)
	})

	it("does not flag >&2 (fd-to-fd)", () => {
		expect(containsShellFileRedirection("echo error >&2")).toBe(false)
	})

	it("does not flag 1>&2 (fd-to-fd)", () => {
		expect(containsShellFileRedirection("cmd 1>&2")).toBe(false)
	})

	it("does not flag <&3 (input fd-to-fd)", () => {
		expect(containsShellFileRedirection("cmd <&3")).toBe(false)
	})

	it("does not flag 0<&4 (input fd-to-fd with explicit fd)", () => {
		expect(containsShellFileRedirection("cmd 0<&4")).toBe(false)
	})

	// Token boundary: >&2file is file redirection, not fd-to-fd
	it("flags >&2file (word starts with digit but is not pure fd)", () => {
		expect(containsShellFileRedirection("echo hi >&2file")).toBe(true)
	})

	it("flags <&3in (word starts with digit but is not pure fd)", () => {
		expect(containsShellFileRedirection("cmd <&3in")).toBe(true)
	})

	// fd-to-fd followed by operators should still strip correctly
	it("does not flag 2>&1 followed by && (chain operator)", () => {
		expect(containsShellFileRedirection("cmd 2>&1&& echo ok")).toBe(false)
	})

	it("detects file redirection after fd-to-fd (2>&1>out.txt)", () => {
		expect(containsShellFileRedirection("cmd 2>&1>out.txt")).toBe(true)
	})

	it("does not flag 0<&4 followed by pipe", () => {
		expect(containsShellFileRedirection("cmd 0<&4| cat")).toBe(false)
	})

	// Should not flag commands without redirection
	it("does not flag plain command", () => {
		expect(containsShellFileRedirection("git status")).toBe(false)
	})

	it("does not flag command with flags", () => {
		expect(containsShellFileRedirection("git log --oneline -n 10")).toBe(false)
	})

	// Mixed: fd redirect + file redirect
	it("detects file redirection even with fd redirect present", () => {
		expect(containsShellFileRedirection("cmd 2>&1 > out.txt")).toBe(true)
	})

	// Quote-aware: operators inside quotes are literal, not redirection
	it("does not flag > inside double quotes (arrow function)", () => {
		expect(containsShellFileRedirection(`node -e "const f=(a)=>a"`)).toBe(false)
	})

	it("does not flag > inside single quotes", () => {
		expect(containsShellFileRedirection("echo 'hello > world'")).toBe(false)
	})

	it("detects > outside quotes even when quoted content has >", () => {
		expect(containsShellFileRedirection(`node -e "x" > out.txt`)).toBe(true)
	})

	it("does not flag < inside double quotes", () => {
		expect(containsShellFileRedirection(`node -e "if (a < b) {}"`)).toBe(false)
	})
})

describe("containsBackgroundOperator", () => {
	it("detects trailing &", () => {
		expect(containsBackgroundOperator("sleep 10 &")).toBe(true)
	})

	it("detects mid-command &", () => {
		expect(containsBackgroundOperator("cmd & other")).toBe(true)
	})

	// Should NOT flag && (chain operator)
	it("does not flag && (chain)", () => {
		expect(containsBackgroundOperator("git add . && git commit")).toBe(false)
	})

	// Should NOT flag &> (redirection)
	it("does not flag &> (redirection)", () => {
		expect(containsBackgroundOperator("cmd &> out.txt")).toBe(false)
	})

	// Should NOT flag fd redirection containing &
	it("does not flag 2>&1 (fd redirection)", () => {
		expect(containsBackgroundOperator("git show 2>&1")).toBe(false)
	})

	it("does not flag >&2 (fd redirection)", () => {
		expect(containsBackgroundOperator("echo error >&2")).toBe(false)
	})

	it("does not flag <&3 (input fd duplication)", () => {
		expect(containsBackgroundOperator("cmd <&3")).toBe(false)
	})

	it("does not flag plain command", () => {
		expect(containsBackgroundOperator("git status")).toBe(false)
	})

	// Quote-aware: & inside quotes is literal
	it("does not flag & inside double quotes", () => {
		expect(containsBackgroundOperator(`node -e "a & b"`)).toBe(false)
	})
})

describe("getCommandDecision with shell operators", () => {
	const allowlist = ["git", "git show", "cat", "echo", "npm"]

	it("auto-approves allowlisted command without shell operators", () => {
		expect(getCommandDecision("git show", allowlist)).toBe("auto_approve")
	})

	it("auto-approves allowlisted command with flags", () => {
		expect(getCommandDecision("git show --stat", allowlist)).toBe("auto_approve")
	})

	it("forces ask_user for output redirection on allowlisted prefix", () => {
		expect(getCommandDecision("git show > ~/.ssh/id_rsa", allowlist)).toBe("ask_user")
	})

	it("forces ask_user for append redirection on allowlisted prefix", () => {
		expect(getCommandDecision("git show >> out.txt", allowlist)).toBe("ask_user")
	})

	it("forces ask_user for input redirection on allowlisted prefix", () => {
		expect(getCommandDecision("cat < /etc/passwd", allowlist)).toBe("ask_user")
	})

	it("forces ask_user for &> redirection on allowlisted prefix", () => {
		expect(getCommandDecision("git show &> out.txt", allowlist)).toBe("ask_user")
	})

	it("forces ask_user for background operator on allowlisted prefix", () => {
		expect(getCommandDecision("git show &", allowlist)).toBe("ask_user")
	})

	it("preserves auto-approve for fd-to-fd redirect (2>&1)", () => {
		expect(getCommandDecision("git show 2>&1", allowlist)).toBe("auto_approve")
	})

	it("preserves auto-approve for input fd-to-fd redirect (<&3)", () => {
		expect(getCommandDecision("cat <&3", allowlist)).toBe("auto_approve")
	})

	it("forces ask_user for >&2file (word redirection, not fd-to-fd)", () => {
		expect(getCommandDecision("echo hi >&2file", allowlist)).toBe("ask_user")
	})

	it("forces ask_user for <&3in (word redirection, not fd-to-fd)", () => {
		expect(getCommandDecision("cat <&3in", allowlist)).toBe("ask_user")
	})

	it("forces ask_user for compound command where one segment has redirection", () => {
		expect(getCommandDecision("git show && echo ok > out.txt", allowlist)).toBe("ask_user")
	})

	it("still asks user for unknown commands (no regression)", () => {
		expect(getCommandDecision("rm -rf /", allowlist)).toBe("ask_user")
	})

	it("still denies denylisted commands (no regression)", () => {
		expect(getCommandDecision("git push", allowlist, ["git push"])).toBe("auto_deny")
	})

	it("forces ask_user for >&file (pre-existing strip regex must not remove it)", () => {
		expect(getCommandDecision("echo hi >&out.txt", allowlist)).toBe("ask_user")
	})
})

// ---------------------------------------------------------------------------
// Shared / regression coverage
// ---------------------------------------------------------------------------

describe("containsDangerousSubstitution (existing, regression)", () => {
	it("detects dangerous parameter expansion", () => {
		expect(containsDangerousSubstitution('echo "${var@P}"')).toBe(true)
	})

	it("does not flag normal commands", () => {
		expect(containsDangerousSubstitution("git status")).toBe(false)
	})
})

describe("findLongestPrefixMatch", () => {
	it("finds exact prefix match", () => {
		expect(findLongestPrefixMatch("git status", ["git"])).toBe("git")
	})

	it("finds longest match among multiple", () => {
		expect(findLongestPrefixMatch("git push origin", ["git", "git push"])).toBe("git push")
	})

	it("returns null for no match", () => {
		expect(findLongestPrefixMatch("npm install", ["git"])).toBe(null)
	})

	it("handles wildcard", () => {
		expect(findLongestPrefixMatch("anything", ["*"])).toBe("*")
	})
})

describe("getSingleCommandDecision", () => {
	it("auto-approves when only allowlist matches", () => {
		expect(getSingleCommandDecision("git status", ["git"], ["npm"])).toBe("auto_approve")
	})

	it("auto-denies when only denylist matches", () => {
		expect(getSingleCommandDecision("rm -rf", [], ["rm"])).toBe("auto_deny")
	})

	it("asks user when no lists match", () => {
		expect(getSingleCommandDecision("unknown", ["git"], ["npm"])).toBe("ask_user")
	})

	it("longer denylist wins conflict", () => {
		expect(getSingleCommandDecision("git push origin", ["git"], ["git push"])).toBe("auto_deny")
	})

	it("longer allowlist wins conflict", () => {
		expect(getSingleCommandDecision("git push --dry-run", ["git push --dry-run"], ["git push"])).toBe(
			"auto_approve",
		)
	})
})
