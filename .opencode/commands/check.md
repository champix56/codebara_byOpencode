---
description: Run lint and typecheck on the project
---

Run the project checks in order and report the results:

1. `npx expo lint`
2. `npx tsc --noEmit`

Fix only errors related to the work done in this session, then re-run both until they pass. If remaining errors come from outside this session's changes, report them without touching unrelated files.
