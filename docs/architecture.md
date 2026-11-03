# Architecture

## Stack

| Élément | Version | Rôle |
| --- | --- | --- |
| Expo | SDK 58 (`expo ~58.0.21`) | Framework applicatif |
| React Native | 0.88.1 | Runtime mobile |
| React | 19.3.0 | UI |
| TypeScript | ~6.0.3 | Typage statique |
| jszip | 3.10.2 | Lecture des archives `.cdz` (ZIP §5.3) — caractères pure JS |
| expo-file-system | ~58 | Cache collection `<idUser>/<id>.cdz` (§6.6, natif ; web → IndexedDB custom) |

## Point d'entrée

L'app utilise **Expo Router** (file-based routing) :

- `package.json` — `main: "expo-router/entry"` : le router enregistre lui-même l'app.
- `src/app/_layout.tsx` — layout racine : `Stack` sans en-têtes (`headerShown: false`).
- `app.json` — configuration Expo : nom, slug, scheme `codebara`, plugins `expo-router` et `expo-camera` (permissions caméra → scanneur de codes-barres), icônes, orientation.

`App.tsx` et `index.ts` (template classique) ont été **supprimés** lors de la migration vers Expo Router.

## Structure actuelle

```text
codEbara/
├── src/
│   ├── app/             # Routes (Expo Router)
│   │   ├── _layout.tsx  # Layout racine (Stack, sans en-têtes)
│   │   ├── index.tsx    # Écran de chargement — route /
│   │   ├── login.tsx    # Écran connexion / création de compte — route /login
│   │   ├── principal.tsx# Fenêtre principale — carte SVG plein écran — route /principal
│   │   ├── usine.tsx    # Scanner + fabrication de carte — route /usine
│   │   ├── carte/[id].tsx # Détail d'une carte — route /carte/[id]
│   │   ├── mairie.tsx   # Informations personnelles — route /mairie
│   │   └── maison.tsx / boutique.tsx / arene.tsx  # Collection / fenêtres vierges
│   ├── components/      # carte-interactive, bandeau-pub, menu-lateral, fenetre-vierge, usine-ecran(.web), fabrication-carte, maison-ecran, carte-detail, mairie-ecran
│   ├── services/        # api.ts (client HTTP serveur) + collection.ts (cache .cdz par utilisateur)
│   ├── store/           # Redux Toolkit — tranche utilisateur persistée (store, utilisateur, hooks)
│   ├── utils/           # Règles métier pures (codes-bar.ts ; hash.ts SHA-256 §3.2 ; motDePasse.ts règle §5.10 ; base64.ts ; cdz.ts ZIP/.cdz §5.3-§6.3)
│   └── data/            # Données de l'app (carte.ts généré)
├── scripts/             # Outils de génération (extraire-carte-svg.mjs)
├── app.config.ts        # Config dynamique — lit DEBUG → extra.debug (bouton debug)
├── .env                 # Variables par défaut versionnées (DEBUG, …)
├── app.json             # Config Expo statique (app.config.ts la complète)
├── tsconfig.json        # TypeScript (strict)
├── expo-env.d.ts        # Types d'assets (auto-généré par expo, non versionné)
├── assets/              # Icônes (œuf), favicon, splash + assets/carte/ (PNP extraits du SVG)
├── .opencode/           # Configuration OpenCode (agents, commands, skills)
├── .claude/             # Plugins Claude
└── docs/                # Cette documentation
```

Les descriptions complètes des écrans vivent dans [`screens/`](./screens/README.md).

## Navigation

Stack racine sans en-têtes, sept routes :

| Route | Fichier | Rôle |
| --- | --- | --- |
| `/` | `src/app/index.tsx` | Chargement (2 tâches factices de 2 s) |
| `/login` | `src/app/login.tsx` | Connexion / création de compte |
| `/principal` | `src/app/principal.tsx` | Fenêtre principale — carte + hotspots + bandeau pub |
| `/usine` | `src/app/usine.tsx` | Scanner + fabrication de carte (caméra natif / saisie web) |
| `/carte/[id]` | `src/app/carte/[id].tsx` | Détail d'une carte (cache local ou serveur) |
| `/maison` `/boutique` `/arene` | `src/app/{maison,boutique,arene}.tsx` | Collection / fenêtres vierges |

Flux : `/` exécute ses tâches puis `router.replace('/login')` — l'écran de chargement est retiré de la pile, donc impossible d'y revenir au bouton retour. Depuis `/login`, `router.replace('/principal')` ; les zones de la carte ouvrent les fenêtres via `router.push` (retour par chevron ou geste système).

## État global (Redux Toolkit)

- `src/store/store.ts` — `store` + `persistor` : persistance **AsyncStorage** (= localStorage sur le web) via redux-persist, clé `racine`, `whitelist: ['utilisateur']` — seule la tranche utilisateur survit au redémarrage.
- `src/store/utilisateur.ts` — tranche `utilisateur` conforme au serveur pyCodebara2 : `idUser` (`id`), `nickname`, `mail`, `amount`, `hash` (champ interne opaque), **`apiToken`** (`API_TOKEN` long) + **`requestToken`** (`API_REQUEST_TOKEN` une-requête, rotatif) ; actions `seConnecter` / `renouvelerRequestToken` (rotation §3.3) / `modifierProfil` (payload partiel — mairie) / `seDeconnecter` ; export `UTILISATEUR_DEBUG` (bypass debug : id `-9999`, nickname `GOD`, hash `null`, tokens `null`, mail `codebara@free.fr`). Le mot de passe clair n'est jamais stocké (envoi : `sha256Hex(mail_exact + motDePasseClair)`, §3.2 — `src/utils/hash.ts`).
- `src/services/api.ts` — client HTTP du serveur (contrat : `integration-client.md` à la racine) : auth login/pass (`GET /user/auth` — §5.2a), auth par tokens (§5.2b), `POST /user` (création — §5.1), `POST /user/renew-password` (§5.9), `PUT /user` (maj profil mairie — §5.10), `POST /card` (génération depuis un code-barres — §5.3, timeout dédié **150 s**, réponse synchrone `card` ou asynchrone `cardid` seul), `GET /card` (liste — §5.4), `GET /card/{id}` (une carte + son fichier — §5.5), `PUT /card/name` (renommage — §5.7, réponse `{cid, card}` sans checksum) ; appels protégés **sérialisés** (§9.1), **rotation** du `API_REQUEST_TOKEN` sur tout succès (§3.3), **mort de session** (« Invalid REQUEST TOKEN ») ET **sortie volontaire** (`quitterSession`, déconnexion mairie) = reset tranche + purge + `/login`, timeout 10 s (hors génération, §2), base URL `EXPO_PUBLIC_SERVER_URL`.
- `src/services/collection.ts` — **cache collection local** (§6.6) : archives `.cdz` + index des noms, dans un répertoire par id utilisateur — natif : `expo-file-system` API nouvelle (`Paths.document/<idUser>/<carteId>.cdz`, sandbox privé : accessible uniquement par l'application) ; web : **IndexedDB** custom (base `codebara-cdz`, expo-file-system est natif-only). Méthodes : `lireIndex`/`majIndex`/`enregistrerCarte`/`lireCarteLocale`.
- `src/utils/cdz.ts` — pipeline `.cdz` : signature ZIP (garde-fou anti tar.xz §5.7), unzip **jszip**, `sha256(bytes)` via `expo-crypto.digest` (contrôle global == `checksum` == `cardHash`, §6.3), contrôles `hashs.json` internes (front/back/perso/datas), `datas.json` parsing tolérant (§6.4). Décision produit : **ZIP uniquement**. `src/utils/base64.ts` — encode/decode pur JS (Hermes).
- `src/store/hooks.ts` — hooks typés `useAppDispatch` / `useAppSelector` : à utiliser partout, jamais les hooks bruts de react-redux.
- Montage : `Provider` + `PersistGate` dans `src/app/_layout.tsx`.
- Redux DevTools : web → extension navigateur (RTK l'active par défaut) ; natif en dev → `@redux-devtools/remote` branché sur le store (`src/store/store.ts`, chemin `__DEV__` non-web), moniteur `npx --yes @redux-devtools/cli redux-devtools` sur le port 8000 et, pour un téléphone physique, `EXPO_PUBLIC_DEVTOOLS_HOST=<IP LAN>` au démarrage. Hermes n'ayant pas le global `crypto` (Web Crypto) requis par `uuid` — transport devtools via socketcluster-client — le store installe un polyfill `global.crypto` via `expo-crypto` **avant** le `require('@redux-devtools/remote')`.
- Déconnexion (bouton du menu latéral, fenêtre principale uniquement) : `dispatch(seDeconnecter())` + `persistor.purge()` puis `router.replace('/login')`.

## Dossiers natifs

`ios/` et `android/` n'existent pas : le projet marche en **génération continue (CNG)**. Ces dossiers sont générés et ne doivent jamais être créés ni édités à la main — toute configuration native passe par `app.json` et les config plugins.
