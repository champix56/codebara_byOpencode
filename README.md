# codEbara

Application mobile (iOS / Android) et web **Expo / React Native**. Une carte plein écran à zones interactives ouvre des fenêtres dédiées : **usine** (scanneur de codes-barres), **maison**, **boutique**, **arène** ; écran de connexion avec un contournement de débogage, bandeau publicitaire et menu latéral de navigation.

## Stack

| Élément | Version | Rôle |
| --- | --- | --- |
| Expo | SDK 58 | Framework applicatif (CNG : `ios/` et `android/` générés, jamais édités à la main) |
| React Native | 0.88 | Runtime mobile |
| TypeScript | ~6.0.3 | Typage statique strict |
| Expo Router | file-based routing | Navigation (`src/app/` = routes) |
| Redux Toolkit | 2.13 | État global (tranche utilisateur **persistée** via redux-persist + AsyncStorage) |
| expo-camera | ~58 | Scanneur de codes-barres (EAN-8, EAN-13, UPC-A, UPC-E) |

## Démarrage

```bash
npm install
npx expo start            # serveur de développement (web + QR codes iOS/Android)
```

Ouverture directe d'une cible :

```bash
npm run web               # navigateur
npm run ios               # émulateur iOS
npm run android           # émulateur Android
```

> Après l'ajout ou la modification d'un config plugin (ex. `expo-camera` dans `app.json`), régénérer le natif : `npx expo run:ios` / `npx expo run:android` (ou un build EAS).

## Débogage (DEBUG)

La variable « bare » **`DEBUG`** (shell ou `.env` versionné) affiche, sur la fenêtre de connexion, le bouton « Debug : passer l'authentification » : il charge le compte GOD dans la tranche utilisateur persistée (`id −9999`, `nickname GOD`, hash `null`, token `-1`, mail `codebara@free.fr`) puis ouvre la fenêtre principale. Le retour normal : `DEBUG=false npx expo start` (le shell l'emporte sur `.env`). Détails dans [`docs/screens/connexion.md`](docs/screens/connexion.md).

## Redux DevTools

- **Web** : rien à configurer — Redux Toolkit active l'extension [Redux DevTools du navigateur](https://chromewebstore.google.com/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpnnfiblib) (les actions et l'état apparaissent dans l'onglet DevTools).
- **Natif (dev)** : `@redux-devtools/remote` est branché sur la création du store (`src/store/store.ts`, uniquement en `__DEV__` non-web) vers un moniteur sur le port 8000 :

```bash
npx --yes @redux-devtools/cli redux-devtools   # moniteur local (UI web/électron)
# téléphone physique : EXPO_PUBLIC_DEVTOOLS_HOST=<IP LAN de votre machine> npx expo start
```

## Commandes courantes

```bash
npx expo lint             # ESLint (config expo)
npx tsc --noEmit          # vérification TypeScript (obligatoires avant de clôturer une tâche)
npx expo-doctor           # diagnostic dépendances/config
npx expo install --fix    # aligne les versions de paquets sur le SDK
npx expo export -p web    # export web statique (vérification d'intégration)
```

## Régénérer la carte

Source de vérité : `../img2.svg` (dossier parent). Le script extrait les PNG dans `assets/carte/` et régénère les géométries :

```bash
node scripts/extraire-carte-svg.mjs
```

## Structure

```text
src/
├── app/          # Routes Expo Router (un fichier = un écran)
├── components/   # carte-interactive, bandeau-pub, menu-lateral, usine-ecran(.web)…
├── store/        # Redux : store + tranche utilisateur persistée + hooks typés
├── utils/        # Règles métier pures (codes-bar : validation EAN/UPC)
└── data/         # carte.ts (généré) — géométrie + zones taponables
docs/             # architecture, conventions, conventions écrans (docs/screens/*)
scripts/          # outils de génération
```

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — stack, routes, état global Redux, règles CNG.
- [`docs/conventions.md`](docs/conventions.md) — règles de projet (docs Expo à vérifier, `EXPO_PUBLIC_`, écrans documentés…).
- [`docs/screens/README.md`](docs/screens/README.md) — index des descriptions d'écrans (`docs/screens/<id>.md`).
