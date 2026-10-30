# Architecture

## Stack

| Élément | Version | Rôle |
| --- | --- | --- |
| Expo | SDK 58 (`expo ~58.0.19`) | Framework applicatif |
| React Native | 0.88.0 | Runtime mobile |
| React | 19.3.0 | UI |
| TypeScript | ~6.0.3 | Typage statique |

## Point d'entrée

L'app utilise **Expo Router** (file-based routing) :

- `package.json` — `main: "expo-router/entry"` : le router enregistre lui-même l'app.
- `src/app/_layout.tsx` — layout racine : `Stack` sans en-têtes (`headerShown: false`).
- `app.json` — configuration Expo : nom, slug, scheme `codebara`, plugin `expo-router`, icônes, orientation.

`App.tsx` et `index.ts` (template classique) ont été **supprimés** lors de la migration vers Expo Router.

## Structure actuelle

```text
codEbara/
├── src/
│   └── app/             # Routes (Expo Router)
│       ├── _layout.tsx  # Layout racine (Stack, sans en-têtes)
│       ├── index.tsx    # Écran de chargement — route /
│       └── login.tsx    # Écran connexion / création de compte — route /login
├── app.json             # Configuration Expo
├── tsconfig.json        # TypeScript (strict)
├── expo-env.d.ts        # Types d'assets (auto-généré par expo, non versionné)
├── assets/              # Icônes (œuf), favicon, splash
├── .opencode/           # Configuration OpenCode (agents, commands, skills)
├── .claude/             # Plugins Claude
└── docs/                # Cette documentation
```

Les descriptions complètes des écrans vivent dans [`screens/`](./screens/README.md).

## Navigation

Stack racine sans en-têtes, deux routes :

| Route | Fichier | Rôle |
| --- | --- | --- |
| `/` | `src/app/index.tsx` | Chargement (2 tâches factices de 2 s) |
| `/login` | `src/app/login.tsx` | Connexion / création de compte |

Flux : `/` exécute ses tâches puis `router.replace('/login')` — l'écran de chargement est retiré de la pile, donc impossible d'y revenir au bouton retour.

## Dossiers natifs

`ios/` et `android/` n'existent pas : le projet marche en **génération continue (CNG)**. Ces dossiers sont générés et ne doivent jamais être créés ni édités à la main — toute configuration native passe par `app.json` et les config plugins.
