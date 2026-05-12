---
description: Audit staged changes for forbidden files (secrets, .env, coverage, pycache) and DDD layer violations before commit. Blocks on critical issues.
---

Run these checks in order. If any check fails, **stop** and report; do not commit.

1. **Staged file scan**: `git diff --cached --name-only`. Block if any path matches:
   - `\.env($|\.local|\.production|\.development)` (only `.env.example` is allowed)
   - `\.coverage$`, `coverage\.xml$`, `htmlcov/`
   - `__pycache__/`, `\.pyc$`, `\.pytest_cache/`
   - `\.next/`, `node_modules/`
   - `\.DS_Store`

2. **DDD direction check**: if any `backend/app/domain/**/*.py` is staged, grep that file for `from app.infrastructure` or `import app.infrastructure`. Block on hit (domain must not depend on infrastructure).

3. **Shared types drift check**: if any `backend/app/domain/entities/*.py` or `backend/app/domain/enums/*.py` is staged, remind: "Domain change — confirm `shared/types/*.ts` is in sync (run `/sync-shared-types`)."

4. **Env var name check**: if any `frontend/**/*.{ts,tsx,js}` is staged, grep the staged content for `NEXT_PUBLIC_API_BASE_URL`. Block on hit (canonical name is `NEXT_PUBLIC_API_URL`).

5. **Summary**: print `git status --porcelain` counts (staged / unstaged / untracked) and pass/fail per check.

Output structure:

```
## Preflight check

| Check | Status |
|-------|--------|
| No forbidden files | PASS/FAIL |
| DDD direction      | PASS/FAIL |
| Shared types drift | NOTE if domain changed |
| Env var name       | PASS/FAIL |

Files: 12 staged, 0 unstaged, 3 untracked
```
