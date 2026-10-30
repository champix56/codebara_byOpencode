# codEbara

Application mobile (iOS / Android) et web **Expo / React Native**. Une carte plein écran à zones interactives ouvre des fenêtres dédiées : **usine** (scanneur de codes-barres), **maison** (collection de cartes), **mairie** (informations personnelles), **boutique**, **arène** ; écran de connexion branché sur le **serveur pyCodebara2**, bandeau publicitaire et menu latéral de navigation.

## Stack

| Élément | Version | Rôle |
| --- | --- | --- |
| Expo | SDK 58 | Framework applicatif (CNG : `ios/` et `android/` générés, jamais édités à la main) |
| React Native | 0.88 | Runtime mobile |
| TypeScript | ~6.0.3 | Typage statique strict |
| Expo Router | file-based routing | Navigation (`src/app/` = routes) |
| Redux Toolkit | 2.13 | État global (tranche utilisateur **persistée** via redux-persist + AsyncStorage) |
| expo-camera | ~58 | Scanneur de codes-barres (EAN-8, EAN-13, UPC-A, UPC-E) |
| expo-crypto | ~58 | SHA-256 du mot de passe (contrat serveur §3.2) + polyfill `crypto` (devtools natif) |

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

## Serveur pyCodebara2

Contrat : [`/home/champix/projets/pyCodebara2/docs/integration-client.md`](../pyCodebara2/docs/integration-client.md).

- Base URL via **`EXPO_PUBLIC_SERVER_URL`** (posée dans `.env`, défaut code `http://localhost:8080`) :
  - web dev : CORS serveur autorise `localhost:8081` / `5173` ;
  - émulateur Android : `EXPO_PUBLIC_SERVER_URL=http://10.0.2.2:8080` dans `.env` ;
  - téléphone physique : `EXPO_PUBLIC_SERVER_URL=http://<IP LAN du PC>:8080` (valeur actuelle du `.env` : `http://192.168.20.205:8080`).
- Authentification : `GET /user/auth` (header `datas`, mot de passe haché `SHA256(mail_exact + clair)` en client, §3.2) → données utilisateur + **double token rotatif** (`API_TOKEN` long + `API_REQUEST_TOKEN` une-requête) — les deux sont **persistés** dans la tranche utilisateur (reprise de session au lancement via l'écran de chargement) ; le `API_REQUEST_TOKEN` est re-émis à chaque succès de route protégée (rotation automatique dans `src/services/api.ts`, appels sérialisés car le serveur n'accepte qu'une requête par couple).
- Création de compte : `POST /user {"mail"}` — le mot de passe est généré et **envoyé par e-mail par le serveur** (désactivé si le serveur tourne en `DEBUG=True`, contrat §12.1). Refus métier = 403 `Forbidden` (mail mal formé ou compte existant — réponses volontairement confondues).
- **Mot de passe oublié** : lien dans la fenêtre de connexion → `POST /user/renew-password {"mail"}` (§5.9, ajouté 2026-10-30) — nouveau mot de passe aléatoire envoyé par e-mail ; réponse **sans token** (pas de rotation) ; erreur 403 `Forbidden` volontairement **ambiguë** (mail mal formé ou compte inconnu) → message ambigu « si ce compte existe… ». En `DEBUG=True` serveur : pas d'e-mail (mot de passe dans le log du serveur).
- La **modification** du profil (nickname) est pour l'instant locale (tranche persistée, fenêtre mairie) : `PUT /user` n'existe pas encore côté serveur (contrat §9.3).
- Bouton debug : le compte GOD chargé n'a **pas** de session — appels protégés inertes tant qu'aucune vraie connexion n'a eu lieu.

## Débogage (DEBUG)

La variable « bare » **`DEBUG`** (shell ou `.env` versionné) affiche, sur la fenêtre de connexion, le bouton « Debug : passer l'authentification » : il charge le compte GOD dans la tranche utilisateur persistée (`id −9999`, `nickname GOD`, hash `null`, token `-1`, mail `codebara@free.fr`) puis ouvre la fenêtre principale. Le retour normal : `DEBUG=false npx expo start` (le shell l'emporte sur `.env`). Détails dans [`docs/screens/connexion.md`](docs/screens/connexion.md).

## Redux DevTools

- **Web** : rien à configurer — Redux Toolkit active l'extension [Redux DevTools du navigateur](https://chromewebstore.google.com/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpnnfiblib) (les actions et l'état apparaissent dans l'onglet DevTools).
- **Natif (dev)** : `@redux-devtools/remote` est branché sur la création du store (`src/store/store.ts`, uniquement en `__DEV__` non-web) vers un moniteur sur le port 8000. Note : Hermes n'expose pas la Web Crypto, indispensable à `uuid` (transport des devtools) — le store pose un polyfill `global.crypto` via `expo-crypto` juste avant de charger la dépendance :

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
├── services/     # api.ts — client HTTP serveur pyCodebara2 (auth, rotation, cartes)
├── store/        # Redux : store + tranche utilisateur persistée + hooks typés
├── utils/        # Règles métier pures (codes-bar, mot de passe SHA-256)
└── data/         # carte.ts (généré) — géométrie + zones taponables
docs/             # architecture, conventions, conventions écrans (docs/screens/*)
scripts/          # outils de génération
```

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — stack, routes, état global Redux, règles CNG.
- [`docs/conventions.md`](docs/conventions.md) — règles de projet (docs Expo à vérifier, `EXPO_PUBLIC_`, écrans documentés…).
- [`docs/screens/README.md`](docs/screens/README.md) — index des descriptions d'écrans (`docs/screens/<id>.md`).
