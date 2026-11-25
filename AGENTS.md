This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Standing rules

The details live in `docs/` (see `docs/README.md`); open only the file you need.

- **Expo APIs change**: before touching Expo/EAS/React Native code, read the `expo` major in `package.json` then the matching docs at `https://docs.expo.dev/versions/v<major>.0.0/` (or `https://docs.expo.dev/llms.txt`). → `docs/conventions.md`
- **No router, no URLs**: state navigation via `src/navigation/navigateur.ts`; the web URL stays at the root. → `docs/navigation.md`, `docs/web-url-figee.md`
- **ASCII-only identifiers**: no accents in code ids, filenames or season `fenetre` values; accents only in displayed text and French docs. → `docs/conventions.md`
- **One Markdown file per screen** asked about: `docs/screens/<screen-id>.md`, never in the conversation. → `docs/screens/README.md`
- **Bump the version for every non-Markdown change**: add the note to `NOTES-VERSION.md`, regenerate with `npm run maj:notes`, and reuse the new version wherever relevant. Markdown-only changes are exempt. → `docs/versioning.md`
- **No build at the end of a task**: the user builds when they choose. Lint/typecheck only. → `docs/development.md`
- Run `npx expo lint` and `npx tsc --noEmit` before declaring a task done.
- `ios/` and `android/` are CNG-generated: never edit them by hand. Always `npx expo install` (or `bunx` when `bun.lock` exists). No secrets in versioned files.
- Prefer recommended Expo modules; check available skills before adding a dependency.
