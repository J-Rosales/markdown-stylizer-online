# Agent Operating Notes

## Persistent memory
This repo uses `AGENTS.md` and `.cursor/rules/` for durable preferences.
Update these files when new long-term conventions are agreed.

## Git workflow triggers
Authorized phrases (uppercase only):
- `SHIP IT`: Create a new kebab-case branch, stage all changes, commit, and
  **print** the exact `git push`, `gh pr create`, and merge commands for the
  user to run locally. Ask for confirmation before merge.
- `SHIP IT NOW`: Same as above, but **print** the commands and instruct the user
  to merge immediately after PR creation (no extra confirmation from the agent).

If the trigger phrase is not present, do not push, open PRs, or merge.
