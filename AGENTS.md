This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- **No router, no URLs.** The app (web included) is a plain SPA: `package.json` → `"main": "index.ts"` calls `registerRootComponent(App)` with the root component in `App.tsx`. Expo Router was removed on 2026-11-11 — do not reintroduce it, no route files, no history writes.
- All navigation is state-based via `src/navigation/navigateur.ts` (`naviguer`, `remplacer`, `retourner`, type `Fenetre`) — root screens live in `src/ecrans/` (chargement, connexion, principal), other windows are rendered by `App.tsx` with the shared header `src/components/entete-ecran.tsx`. Keep non-screen code (components, hooks, utils) outside `src/ecrans/`.
- On web the browser URL must always stay at the root (`src/utils/figerUrl.ts`, applied in `index.ts`); no path may ever select a specific screen — the app always starts from the chargement splash.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Screen documentation rule (constant)

Every screen ("fenêtre") the user asks about MUST be described in its own dedicated Markdown file — never in the conversation — to limit token usage:

- Location: `docs/screens/<screen-id>.md`, one file per screen, `<screen-id>` in kebab-case matching the window name.
- If the file already exists, read it and update it in place instead of rewriting from scratch.
- File structure: Rôle, Structure visuelle, États, Navigation, + notes when needed (keep it concise, write in French).
- Add the new file to the index table in `docs/screens/README.md`.
- In the conversation, reply with the file path and a one-line summary only. Never paste the full description.
