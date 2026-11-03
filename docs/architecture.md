# Architecture

## Stack

| Élément | Version | Rôle |
| --- | --- | --- |
| Expo | SDK 58 (`expo ~58.0.21`) | Framework applicatif |
| React Native | 0.88.1 | Runtime mobile |
| React | 19.3.0 | UI |
| TypeScript | ~6.0.3 | Typage statique |

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
│   │   ├── usine.tsx    # Scanneur de codes-barres (natif) / formulaire (web) — route /usine
│   │   └── maison.tsx / boutique.tsx / arene.tsx  # Fenêtres vierges
│   ├── components/      # carte-interactive, bandeau-pub, menu-lateral, fenetre-vierge, usine-ecran(.web), maison-ecran, mairie-ecran
│   ├── services/        # api.ts — client HTTP du serveur pyCodebara2 (auth, cartes, rotation)
│   ├── store/           # Redux Toolkit — tranche utilisateur persistée (store, utilisateur, hooks)
│   ├── utils/           # Règles métier pures (codes-bar.ts : validation EAN/UPC ; hash.ts : SHA-256 §3.2 ; motDePasse.ts : règle de complexité §5.10)
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
| `/usine` | `src/app/usine.tsx` | Scanneur de codes-barres (natif) / formulaire (web) |
| `/maison` `/boutique` `/arene` | `src/app/{maison,boutique,arene}.tsx` | Fenêtres vierges |

Flux : `/` exécute ses tâches puis `router.replace('/login')` — l'écran de chargement est retiré de la pile, donc impossible d'y revenir au bouton retour. Depuis `/login`, `router.replace('/principal')` ; les zones de la carte ouvrent les fenêtres via `router.push` (retour par chevron ou geste système).

## État global (Redux Toolkit)

- `src/store/store.ts` — `store` + `persistor` : persistance **AsyncStorage** (= localStorage sur le web) via redux-persist, clé `racine`, `whitelist: ['utilisateur']` — seule la tranche utilisateur survit au redémarrage.
- `src/store/utilisateur.ts` — tranche `utilisateur` conforme au serveur pyCodebara2 : `idUser` (`id`), `nickname`, `mail`, `amount`, `hash` (champ interne opaque), **`apiToken`** (`API_TOKEN` long) + **`requestToken`** (`API_REQUEST_TOKEN` une-requête, rotatif) ; actions `seConnecter` / `renouvelerRequestToken` (rotation §3.3) / `modifierProfil` (payload partiel — mairie) / `seDeconnecter` ; export `UTILISATEUR_DEBUG` (bypass debug : id `-9999`, nickname `GOD`, hash `null`, tokens `null`, mail `codebara@free.fr`). Le mot de passe clair n'est jamais stocké (envoi : `sha256Hex(mail_exact + motDePasseClair)`, §3.2 — `src/utils/hash.ts`).
- `src/services/api.ts` — client HTTP du serveur (contrat : `integration-client.md` à la racine) : auth login/pass (`GET /user/auth`, données + les **deux** tokens ré-émis — §5.2a), auth par tokens (reprise de session, données seules — §5.2b), `POST /user` (création, mail seul — §5.1), `POST /user/renew-password` (mot de passe oublié — §5.9, succès sans token, erreurs 403 `Forbidden` **ambiguës par conception**), `PUT /user` (maj profil mairie — §5.10 : mot de passe haché `SHA256(mail_courant + clair)` **côté client** après validation de la règle, rotation sur 200), `GET /card` (liste des cartes du joueur — §5.4) ; appels protégés **sérialisés** (file d'attente : le couple de tokens ne peut servir qu'une requête — §9.1), **rotation** du `API_REQUEST_TOKEN` sur tout succès de route protégée (§3.3), **mort de session** (« Invalid REQUEST TOKEN ») ET **sortie volontaire** (`quitterSession`, déconnexions mairie) = reset de la tranche + purge de la persistance + `/login`, timeout 10 s (contrat §2), base URL `EXPO_PUBLIC_SERVER_URL` (valeur `.env`, défaut `http://localhost:8080`).
- `src/store/hooks.ts` — hooks typés `useAppDispatch` / `useAppSelector` : à utiliser partout, jamais les hooks bruts de react-redux.
- Montage : `Provider` + `PersistGate` dans `src/app/_layout.tsx`.
- Redux DevTools : web → extension navigateur (RTK l'active par défaut) ; natif en dev → `@redux-devtools/remote` branché sur le store (`src/store/store.ts`, chemin `__DEV__` non-web), moniteur `npx --yes @redux-devtools/cli redux-devtools` sur le port 8000 et, pour un téléphone physique, `EXPO_PUBLIC_DEVTOOLS_HOST=<IP LAN>` au démarrage. Hermes n'ayant pas le global `crypto` (Web Crypto) requis par `uuid` — transport devtools via socketcluster-client — le store installe un polyfill `global.crypto` via `expo-crypto` **avant** le `require('@redux-devtools/remote')`.
- Déconnexion (bouton du menu latéral, fenêtre principale uniquement) : `dispatch(seDeconnecter())` + `persistor.purge()` puis `router.replace('/login')`.

## Dossiers natifs

`ios/` et `android/` n'existent pas : le projet marche en **génération continue (CNG)**. Ces dossiers sont générés et ne doivent jamais être créés ni édités à la main — toute configuration native passe par `app.json` et les config plugins.
