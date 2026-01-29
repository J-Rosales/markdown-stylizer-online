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

## Session deproxy for git/gh
Networked Git operations fail because the agent runtime injects proxy env vars
pointing to `127.0.0.1:9`. Clear them at the start of each session or before
any `git`/`gh` network command.

### Recommended session bootstrap
Run once per session:

```powershell
Remove-Item Env:HTTP_PROXY,Env:HTTPS_PROXY,Env:ALL_PROXY -ErrorAction SilentlyContinue; $env:NO_PROXY="github.com,api.github.com,*.github.com"
```

### Fallback per-command shim
If proxies reappear, wrap commands:

```powershell
function git { param([Parameter(ValueFromRemainingArguments=$true)]$a); Remove-Item Env:HTTP_PROXY,Env:HTTPS_PROXY,Env:ALL_PROXY -ErrorAction SilentlyContinue; $env:NO_PROXY="github.com,api.github.com,*.github.com"; & (Get-Command git.exe).Source @a }
function gh  { param([Parameter(ValueFromRemainingArguments=$true)]$a); Remove-Item Env:HTTP_PROXY,Env:HTTPS_PROXY,Env:ALL_PROXY -ErrorAction SilentlyContinue; $env:NO_PROXY="github.com,api.github.com,*.github.com"; & (Get-Command gh.exe).Source @a }
```

### Verification
Run:

```powershell
gci env:*proxy* | sort name | ft -auto; git ls-remote https://github.com/git/git; gh auth status
```
