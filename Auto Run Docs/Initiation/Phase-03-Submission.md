# Phase 03: Submission

This final phase handles the submission of the changes to the remote repository. It ensures that the work is safely committed and pushed, completing the workflow.

## Tasks

- [ ] Commit and push changes:

    - Check `git status` to verify changed files
    - Stage relevant files (code, tests, docs)
    - Commit with descriptive message (e.g., "feat: update ask_followup_question to support multiple questions (PR review fixes)")
    - Push to remote branch using `git push`

- [ ] Final verification:
    - Check `gh pr view 11139` to confirm updates are reflected
    - Verify CI status using `gh pr checks 11139` (if available)
