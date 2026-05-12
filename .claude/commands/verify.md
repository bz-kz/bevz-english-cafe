---
description: Run lint, type-check, tests, and build across frontend + backend. Output a PASS/FAIL table per layer. Stops on the first failure and surfaces the first 40 lines of output.
---

Execute the verification gate in this order. Stop on the first failure and show the first 40 lines of its output. Do NOT attempt fixes — only report.

1. **Frontend lint**: `cd frontend && npm run lint`
2. **Backend lint**: `cd backend && uv run ruff check .`
3. **Backend format**: `cd backend && uv run ruff format --check .`
4. **Frontend types**: `cd frontend && npx tsc --noEmit`
5. **Backend types** (only if `[tool.mypy]` exists in `backend/pyproject.toml`): `cd backend && uv run mypy app/domain app/services`
6. **Frontend tests**: `cd frontend && npm test -- --watchAll=false`
7. **Backend tests**: `cd backend && uv run pytest`
8. **Frontend build** (only if 1–7 pass): `cd frontend && npm run build`

After all steps run (or one fails), output a markdown table:

```
| Step | Status |
|------|--------|
| Frontend lint | PASS/FAIL |
...
```

If everything passes, report: `All checks passed.`
