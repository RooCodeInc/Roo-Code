import * as path from "path"
import * as os from "node:os"

import type { JobType, JobPayload } from "@/types"

import { runTask } from "../runTask"
import { Logger } from "../logger"

const jobType: JobType = "github.issue.fix"

type FixGitHubIssueJobPayload = JobPayload<"github.issue.fix">

export async function fixGitHubIssue(jobPayload: FixGitHubIssueJobPayload): Promise<{
	repo: string
	issue: number
	result: unknown
}> {
	const prompt = `
Fix the following GitHub issue:

Repository: ${jobPayload.repo}
Issue #${jobPayload.issue}: ${jobPayload.title}

Description:
${jobPayload.body}

${jobPayload.labels && jobPayload.labels.length > 0 ? `Labels: ${jobPayload.labels.join(", ")}` : ""}

Please analyze the issue, understand what needs to be fixed, and implement a solution.

When you're finished, create a git branch to store your work and then submit a pull request using the "gh" command line tool:
gh pr create --title "Fixes #${jobPayload.issue}\n\n[Your PR description here.]" --fill --template "pull_request_template.md"

Your job isn't done until you've created a pull request. Try to solve any git issues that arise while creating your branch and submitting your pull request.
`.trim()

	const { repo, issue } = jobPayload

	const result = await runTask({
		jobType,
		jobPayload,
		prompt,
		publish: async () => {},
		logger: new Logger({ logDir: path.resolve(os.tmpdir(), "logs"), filename: "worker.log", tag: "worker" }),
	})

	return { repo, issue, result }
}
