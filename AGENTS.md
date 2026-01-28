# Agent Operating Notes

## Persistent memory
This repo uses `AGENTS.md` and `.cursor/rules/` for durable preferences.
Update these files when new long-term conventions are agreed.

## Git workflow triggers
Authorized phrases (uppercase only):
- `SHIP IT`: Create a new kebab-case branch, stage all changes, commit, push,
  open a PR to `main`, then request confirmation before merging.
- `SHIP IT NOW`: Same as above, but merge to `main` immediately after PR
  creation.

If the trigger phrase is not present, do not push, open PRs, or merge.
