# Implement GitHub Issue
Given an issue number:
1. Fetch issue with `gh issue view <N>`
2. Create branch `issue-<N>-<slug>`
3. Implement changes (migrations, hooks, screens, tests)
4. Run `npm run type-check && npm run lint`
5. Commit, push, open PR with `Closes #<N>`
