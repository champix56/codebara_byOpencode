---
name: Project Docs
description: Project documentation for codEbara — architecture, structure, and file map of the docs/ directory. Use when asked about the project's architecture, how it is organized, its commands, or its conventions.
---

## Workflow

1. Read `../../../docs/README.md` to locate the relevant documentation.
2. Read ONLY the file that matches the user's question (anti-token rule: never load the whole directory):
   - `architecture.md` — stack, entry point, folder structure, native folders (CNG); points to the detailed files below
   - `navigation.md` — window stack (no router), chargement/connexion/principal flows, redirections
   - `web-url-figee.md` — web URL locked to root (figerUrl.ts), web notes
   - `etat-global.md` — Redux Toolkit: persisted store, user slice (tokens), DevTools, logout
   - `services-serveur.md` — api.ts (HTTP client), collection.ts (.cdz cache), verification.ts
   - `cdz-pipeline.md` — .cdz archive reading/validation (ZIP, sha256, hashs.json, seasons)
   - `visuel-carte-3d.md` — 3D card showcase (rotation, tilt, zoom)
   - `serveur-dev-https.md` — self-signed dev HTTPS certificate (generation, Android/iOS integration)
   - `development.md` — installation, dev commands, checks, EAS builds
   - `conventions.md` — coding rules, Expo documentation policy, hard rules
   - `screens/<id>.md` — screen-by-screen ("fenêtre") descriptions; index in `screens/README.md`
3. Answer based on these files. If the docs are out of date with the code, point out the discrepancy and suggest updating them.
