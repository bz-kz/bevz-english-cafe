---
description: Dispatch the subagent team for a refactor stage (A, B, C, or D) as defined in /Users/kz/.claude/plans/e-async-pearl.md. Runs items in the order and parallelism specified by the plan, gates each stage with cross-cutting-reviewer.
argument-hint: <A|B|C|D>
---

Stage: $ARGUMENTS

Read `/Users/kz/.claude/plans/e-async-pearl.md` and locate the section for the requested stage. For each subtask under that stage:

1. **Identify the owner agent** from the plan's "担当" annotation (e.g., `backend-refactorer`).
2. **Compose a change-spec** for that subtask (intent, files+line ranges, verification commands, non-goals).
3. **Dispatch the owner agent** via the Task tool. Use parallel dispatch (one message with multiple tool uses) ONLY when the plan marks two subtasks as having disjoint file sets — otherwise serial.
4. **Receive the diff report**.
5. **Dispatch `cross-cutting-reviewer`** with the diff and the change-spec.
6. If verdict is FAIL, re-dispatch the owner agent with the blocker list. Repeat until PASS or PASS_WITH_NITS.
7. Once all subtasks pass, **the main session** (not a subagent) creates the commit(s) and the stage tag (`v0.A-divergences`, `v0.B-architecture`, etc.).

**Rules:**
- Never have two refactorers edit the same file in parallel (e.g., `backend/app/main.py`, `shared/types/contact.ts` are single-writer).
- Never skip the reviewer gate.
- Never let a subagent run `git commit` or `git tag`.

If $ARGUMENTS is empty or not A|B|C|D, list available stages from the plan and stop.
