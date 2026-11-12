# Développement

## Prérequis

- Node.js (LTS) et npm
- Expo Go sur mobile pour tester rapidement — attention, il inclut seulement les modules natifs fournis avec Expo

## Installation

```bash
npm install
```

## Lancer le projet

```bash
npm run start      # serveur de dev Expo
npm run android    # + cible Android
npm run ios        # + cible iOS
npm run web        # + cible Web
```

## Débogage web (Chrome / VS Code)

En dev web, le serveur Metro ne sert qu'**un seul bundle** —
`localhost:8081/index.ts.bundle` (point d'entrée `index.ts`, toute l'app
inlinée, ~370 modules) — accompagné d'**une seule sourcemap « sectionnée »**.
Conséquence dans l'onglet **Sources** de DevTools : il
n'existe pas de nœud `localhost:8081/src/…` — l'arbre paraît vide tant qu'on
n'a pas déplié l'entrée du bundle, et la map est chargée de façon paresseuse
(quelques secondes de blanc). Chrome moderne le parse sans problème (155,
vérifié).

- Le plus rapide : Sources → `Ctrl+P` → taper `chargement`, `maison-ecran`,
  `figerUrl`… → le fichier TS/TSX s'ouvre directement (les sources mappées sont
  cherchables), points d'arrêt posables.
- Sinon : déplier `localhost:8081 → index.ts.bundle` et
  attendre l'affichage des fichiers.
- Si l'arborescence reste vide : ⚙ DevTools → préférences **Sources** →
  « Enable JavaScript source maps » + cache réseau désactivé + rechargement dur.
- Déboguer **uniquement via le serveur de dev** : l'export
  `npx expo export --platform web` (`dist/`) sert un bundle de production
  minifié **sans sourcemap** — à peine lisible dans les Sources.
- VS Code : `.vscode/launch.json` (« codEbara web (Chrome) ») lance un Chrome
  instrumenté et pose les points d'arrêt directement dans les `.ts/.tsx` de
  l'éditeur — la règle `sourceMapPathOverrides` ramène les chemins absolus de
  la map au workspace.
- À ne pas confondre : la touche `j` d'Expo CLI ouvre les React Native DevTools
  pour l'app **native** ; sur web, c'est le DevTools Chrome standard.


## Vérifications

À exécuter avant de déclarer une tâche terminée :

```bash
npx expo lint      # lint
npx tsc --noEmit   # typecheck
```

Diagnostics complémentaires :

```bash
npx expo-doctor          # dépendances et configuration
npx expo install --fix   # aligner les versions de packages sur le SDK
```

## Gestion des dépendances

TOUJOURS utiliser `npx expo install <package>` plutôt que `npm`/`yarn`/`pnpm`/`bun add —` cela résout des versions compatibles avec le SDK d'Expo.

Si le projet passe à Bun (`bun.lock` présent), remplacer `npx` par `bunx` dans tous les exemples.

## Builds avec EAS

EAS build, signe et soumet l'app dans le cloud — pas besoin de Xcode ni d'Android Studio en local. Utiliser `npx eas-cli@latest` :

```bash
npx eas-cli build      # build cloud (signature incluse)
npx eas-cli submit     # soumission aux stores
npx eas-cli update     # mises à jour over-the-air
```

Après l'ajout d'une librairie avec du code natif, l'app exige un **build de développement** : `npx expo run:ios` / `npx expo run:android` en local, ou `eas build --profile development`.
