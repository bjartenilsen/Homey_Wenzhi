# Workflow Rules

## Git Commits
After completing any task:
1. Stage all changed files related to the task
2. Commit with a message derived from the task description
3. Use conventional commit format: `type(scope): description`
   - `feat` - new feature
   - `fix` - bug fix
   - `refactor` - code restructuring
   - `test` - adding/updating tests
   - `docs` - documentation changes
   - `chore` - maintenance tasks

Example: Task "Add zone status parser for IAS cluster" → `feat(lib): add zone status parser for IAS cluster`
