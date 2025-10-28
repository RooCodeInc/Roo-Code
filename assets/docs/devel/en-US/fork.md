# CoStrict Project Contribution Process

The CoStrict project adopts GitHub Forking workflow.

Detailed steps for GitHub Forking workflow:

1. **Fork the remote repository to your account**

    Visit https://github.com/zgsm-ai/costrict, click the **Fork** button at top-right. The forked repository address will be:
    `https://github.com/{{your_account}}/zgsm`

2. **Clone the forked repository locally**

```bash
$ git clone https://github.com/{{your account}}/zgsm
$ cd zgsm
$ git remote add upstream https://github.com/zgsm-ai/costrict
$ git remote set-url --push upstream no_push # Never push to upstream main
$ git remote -v # Confirm that your remotes make sense
origin	https://github.com/{{your account}}/zgsm(fetch)
origin	https://github.com/{{your account}}/zgsm(push)
upstream	https://github.com/marmotedu/zgsm(fetch)
upstream	https://github.com/marmotedu/zgsm(push)
```

3. **Create a feature branch**

First, synchronize the local `main` branch to match the latest state of `upstream/main`

```bash
$ git fetch upstream
$ git checkout main
$ git rebase upstream/main
```

Create a feature branch:

```bash
$ git checkout -b feature/add-function
```

4. **Develop code**

Rebase to `upstream/main` first:

```bash
$ git fetch upstream # commit 前需要再次同步feature跟upstream/main
$ git rebase upstream/main
```

5. **Commit changes** (For commit specifications, refer to: [Commit Specifications](https://github.com/zgsm-ai/costrict/blob/main/docs/devel/en-US/commit-message.md))

Develop code on the `feature/add-function` branch. After completing development, commit the changes:

```bash
$ git add <file> # 注意：如果有新文件生成，也要 add 进去
$ git status
$ git commit
```

After branch development, there may be multiple commits. However, when merging into the main branch, it's often desirable to have only one (or at most two or three) commits for clarity and easier management. Use `git rebase` to consolidate commits

```bash
$ git rebase -i origin/main
```

The `-i` parameter enables interactive mode. For example:

```bash
pick 07c5abd Introduce OpenPGP and teach basic usage
pick de9b1eb Fix PostChecker::Post#urls
pick 3e7ee36 Hey kids, stop all the highlighting
pick fa20af3 git interactive rebase, squash, amend

# Rebase 8db7e8b..fa20af3 onto 8db7e8b
#
# Commands:
#  p, pick = use commit
#  r, reword = use commit, but edit the commit message
#  e, edit = use commit, but stop for amending
#  s, squash = use commit, but meld into previous commit
#  f, fixup = like "squash", but discard this commit's log message
#  x, exec = run command (the rest of the line) using shell
#
# These lines can be re-ordered; they are executed from top to bottom.
#
# If you remove a line here THAT COMMIT WILL BE LOST.
#
# However, if you remove everything, the rebase will be aborted.
#
# Note that empty commits are commented out
```

In the interactive interface above, first list the 4 latest commits of current branch (newer commits at bottom). Each commit has an action command prefix, with pick as default indicating the commit is selected for rebase operation.

Below these 4 commits are various comments listing available commands:

- pick: Keep commit as is
- reword: Select and modify commit message
- edit: Select and pause rebase to modify commit (see reference)
- squash: Merge current commit with previous one
- fixup: Same as squash but discard current commit message
- exec: Execute other shell command

Among these 6 commands, squash and fixup can be used to merge commits. First modify the verb prefix of target commits to squash (or s):

```bash
pick 07c5abd Introduce OpenPGP and teach basic usage
s de9b1eb Fix PostChecker::Post#urls
s 3e7ee36 Hey kids, stop all the highlighting
pick fa20af3 git interactive rebase, squash, amend
```

After making these changes and executing, the current branch will only retain two commits. Both the second and third line commits will be merged into the first line's commit. The commit message will include all three original commit messages:

```bash
# This is a combination of 3 commits.
# The first commit's message is:
Introduce OpenPGP and teach basic usage

# This is the 2nd commit message:
Fix PostChecker::Post#urls

# This is the 3rd commit message:
Hey kids, stop all the highlighting
```

If changing the third line's squash command to a fixup command:

```bash
pick 07c5abd Introduce OpenPGP and teach basic usage
s de9b1eb Fix PostChecker::Post#urls
f 3e7ee36 Hey kids, stop all the highlighting
pick fa20af3 git interactive rebase, squash, amend
```

The execution result remains identical. Two commits will still be generated after running, where both the second and third line commits get merged into the first line's commit. However, in the new commit message, the third commit's submission information will be commented out:

```bash
# This is a combination of 3 commits.
# The first commit's message is:
Introduce OpenPGP and teach basic usage

# This is the 2nd commit message:
Fix PostChecker::Post#urls

# This is the 3rd commit message:
# Hey kids, stop all the highlighting
```

There's another simplified method to merge commits: first undo the last 5 commits, then create a new one:

```bash
$ git reset HEAD~5
$ git add .
$ git commit -am "Here's the bug fix that closes #28"
$ git push --force
```

The `squash` and `fixup` commands can also be used as command-line arguments to automatically merge commits.

```bash
$ git commit --fixup
$ git rebase -i --autosquash
```

6. Push the feature branch to your personal remote repository

After completing development and committing changes, you need to push the feature branch to the remote code repository.

```bash
$ git push -f origin feature/add-function
```

7. Create a pull request on your personal remote repository page.

After pushing to the remote repository, you can submit a pull request to the main branch. The Maintainer of the CoStrict project will then review the code and merge it into the main branch.
