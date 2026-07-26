# docs/plans/

Live work only. PRD = what/why. Plan = phases + acceptance criteria.

**Delete a plan when its last box is checked.** Written before the work, so it's wrong wherever
the code diverged — and reads like an outstanding spec.

Nothing durable lives in a plan. Decisions + rejected alternatives + consequences →
[docs/adr/](../adr/). Vocabulary → [CONTEXT.md](../../CONTEXT.md). Homeless leftover = give it
a home, then delete.

Deleted plans stay in history: `git log --diff-filter=D -- docs/plans/ plans/`; each deletion
message names its files.

Empty `docs/plans/` = nothing in flight. This file holds the directory open.
