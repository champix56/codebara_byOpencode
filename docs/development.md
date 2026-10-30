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
