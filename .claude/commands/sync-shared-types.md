---
description: Reconcile shared/types/*.ts with backend domain enums (LessonType, PreferredContact, ContactStatus). Backend is the truth source; frontend follows.
---

The backend is the source of truth for these enums. The frontend's `shared/types/contact.ts` may have drifted.

Steps:

1. Read `backend/app/domain/entities/contact.py` (or post-Stage-B5: `backend/app/domain/enums/contact.py`). Extract enum values for `LessonType`, `PreferredContact`, `ContactStatus`.
2. Read `shared/types/contact.ts`. Extract union literal values for `lessonType`, `preferredContact`, `status`.
3. Produce a diff table:

```
| Enum | Backend values | Frontend values | Missing on frontend | Extra on frontend |
|------|----------------|-----------------|---------------------|-------------------|
```

4. If any rows have non-empty "Missing on frontend", propose a **single edit** to `shared/types/contact.ts` that aligns the unions with backend. Show the diff but do NOT apply yet — return the proposal.
5. Grep `frontend/src` for the affected type names (`lessonType`, `preferredContact`, etc.) and list call sites that may need UI affordances if new values were added.
6. **Never edit backend enums from this command.** Frontend follows backend, not the other way around.

If all unions are in sync, report: `Shared types are in sync with backend.`
