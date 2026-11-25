---
description: Prepare, commit and push the current changes safely
---

Use this workflow for every commit in this repository. Never build at the end (the user builds when they want).

1. Inspect the tree with `git status --short` and `git diff --stat`. Generated outputs (`dist/`, `*.apk`, `node_modules/`, `ios/`, `android/`) are ignored — never `git add -f` them.
2. Run the project checks (`/check`): `npx expo lint` then `npx tsc --noEmit`. Fix only errors caused by this session.
3. If any non-`.md` file changed, apply the version rule from `docs/versioning.md`: add a `## v0.0.x` section at the top of `NOTES-VERSION.md`, then run `npm run maj:notes`. Markdown-only changes do not bump the version.
4. Update the affected documentation (`/docs`), especially `docs/screens/<id>.md` and its index when a screen changed.
5. Synchronize before committing: `git pull --rebase`. Stop and report if a conflict appears — never force-push or discard local work.
6. Stage only the files related to the task, then check `git diff --cached --stat` before committing.
7. Commit in French with a short imperative message; mention the new version when one was bumped.
8. Push with `git push` (permission may be requested by the harness). Report the final branch state and anything left unpushed.
