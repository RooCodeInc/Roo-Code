import {
	containsDangerousSubstitution,
	getCommandDecision,
	findLongestPrefixMatch,
	isAutoApprovedSingleCommand,
} from "../commands"

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

describe("findLongestPrefixMatch — trailing wildcard support", () => {
	it("should match 'git*' against 'git commit -m \"Fix nav bar\"'", () => {
		expect(findLongestPrefixMatch('git commit -m "Fix nav bar"', ["git*"])).toBe("git*")
	})

	it("should match 'git *' against 'git commit' but not 'gitk'", () => {
		// "git *" normalizes to "git " (with trailing space)
		expect(findLongestPrefixMatch("git commit", ["git *"])).toBe("git *")
		expect(findLongestPrefixMatch("gitk", ["git *"])).toBeNull()
	})

	it("should match 'git*' against 'gitk' (no space required)", () => {
		expect(findLongestPrefixMatch("gitk", ["git*"])).toBe("git*")
	})

	it("should strip multiple trailing asterisks", () => {
		expect(findLongestPrefixMatch("git status", ["git**"])).toBe("git**")
	})

	it("should prefer a longer trailing-wildcard prefix over a shorter one", () => {
		expect(findLongestPrefixMatch("git push origin", ["git*", "git push*"])).toBe("git push*")
	})

	it("should prefer a specific trailing-wildcard prefix over standalone '*'", () => {
		expect(findLongestPrefixMatch("git status", ["*", "git*"])).toBe("git*")
	})

	it("should still match standalone '*' when no other prefix matches", () => {
		expect(findLongestPrefixMatch("unknown command", ["*", "git*"])).toBe("*")
	})

	it("should return null when no prefix matches and no wildcard present", () => {
		expect(findLongestPrefixMatch("npm install", ["git*"])).toBeNull()
	})
})

describe("isAutoApprovedSingleCommand — trailing wildcard support", () => {
	it("should auto-approve 'git commit -m ...' when allowedCommands has 'git*'", () => {
		expect(isAutoApprovedSingleCommand('git commit -m "Fix dark mode"', ["git*"])).toBe(true)
	})

	it("should not auto-approve 'npm install' when allowedCommands has 'git*'", () => {
		expect(isAutoApprovedSingleCommand("npm install", ["git*"])).toBe(false)
	})

	it("should auto-approve 'git commit' with 'git *' but not 'gitk'", () => {
		expect(isAutoApprovedSingleCommand("git commit", ["git *"])).toBe(true)
		expect(isAutoApprovedSingleCommand("gitk", ["git *"])).toBe(false)
	})
})

describe("getCommandDecision — trailing wildcard with deny list", () => {
	it("should auto-approve 'git status' with 'git*' in allowlist", () => {
		expect(getCommandDecision("git status", ["git*"], [])).toBe("auto_approve")
	})

	it("should deny 'git push' when denied and allowed with equal-length prefixes", () => {
		// "git*" (length 4) vs "git push" (length 8) in denylist -> deny wins (longer)
		expect(getCommandDecision("git push origin", ["git*"], ["git push"])).toBe("auto_deny")
	})

	it("should approve 'git status' when denied prefix is less specific", () => {
		// "git status*" (length 11) vs "git*" (length 4) in denylist -> allow wins (longer)
		expect(getCommandDecision("git status", ["git status*"], ["git*"])).toBe("auto_approve")
	})
})
