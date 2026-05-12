---
description: Snapshot of harness state (settings/hooks/agents/commands/CI) plus known drifts. Useful at the start of a refactor session or after a stage gate.
---

Output a markdown report covering:

### Harness

- `.claude/settings.json` exists? (yes/no)
- Hooks configured by event: count `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop` entries (via `jq` on settings.json)
- Agents present: `ls .claude/agents/*.md | wc -l` plus filenames
- Commands present: `ls .claude/commands/*.md | wc -l` plus filenames
- Pre-commit installed? (`test -f .git/hooks/pre-commit`)

### Git

- Current branch: `git branch --show-current`
- HEAD: `git log -1 --oneline`
- Tags: `git tag -l | tail -10`
- Status: `git status --porcelain | wc -l` (staged + unstaged + untracked)
- Last 5 commits: `git log --oneline -5`

### Drift checks

- LessonType: count values in `backend/app/domain/entities/contact.py` (or `backend/app/domain/enums/contact.py` post-Stage-B5) vs the union in `shared/types/contact.ts`. Report `7 vs 7 ✓` or `7 vs 4 ✗`.
- Env var name: `grep -rn "NEXT_PUBLIC_API_BASE_URL" frontend/ shared/ | wc -l` (should be 0 post Stage A2)
- CORS posture: `grep -n 'allow_origins=\["\*"\]' backend/app/main.py` (should be 0 post Stage A5)
- Empty stub: `test -d backend/app/repositories && echo "EXISTS ✗" || echo "GONE ✓"` (should be GONE post Stage A3)

### Optional: CI

- `scripts/local-ci.sh` exists? Last run summary (look at git log for "ci:" commits).

Format the output as 4 sections with clear headers.
