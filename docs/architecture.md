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

L'app est une **SPA sans router et sans URL** (exigence produit 2026-11-11 : aucun
chemin ne doit accéder à une page ou une construction particulière) — modèle
classique Expo :

- `package.json` — `main: "index.ts"` : point d'entrée (résolu par Expo CLI avec les extensions bare).
- `index.ts` — `registerRootComponent(App)` (doc SDK 58 : registerRootComponent) + pose du verrou d'URL web (`verrouillerUrlRacine`).
- `App.tsx` — composant racine : `SafeAreaProvider` + `Provider` (Redux) + `PersistGate`, rend la fenêtre courante de la pile `src/navigation/navigateur.ts`.
- `app.json` — configuration Expo : nom, slug, plugins `expo-camera` (permissions caméra → scanneur de codes-barres), icônes, orientation. Plus de plugin `expo-router` ni de `scheme` (aucune URL).

Expo Router a été **retiré** du projet le 2026-11-11 (dépendance, plugin, `src/app/`).

## Structure actuelle

```text
codEbara/
├── App.tsx               # Composant racine — fenêtre courante + SafeAreaProvider + Redux
├── index.ts              # Point d'entrée (main package.json) — registerRootComponent(App)
├── src/
│   ├── ecrans/           # Écrans racine : chargement (entrée), connexion, principal
│   ├── navigation/       # navigateur.ts — pile de fenêtres en mémoire (AUCUNE route)
│   ├── components/       # carte-interactive, bandeau-pub, menu-lateral, fenetre-vierge, entete-ecran, usine-ecran(.web), fabrication-carte, maison-ecran, carte-detail, visuel-carte, mairie-ecran
│   ├── services/        # api.ts (client HTTP serveur) + collection.ts (cache .cdz par utilisateur) + verification.ts (hash cache ↔ serveur)
│   ├── store/           # Redux Toolkit — tranche utilisateur persistée (store, utilisateur, hooks)
│   ├── utils/           # Règles métier pures (codes-bar.ts ; hash.ts SHA-256 §3.2 ; motDePasse.ts règle §5.10 ; base64.ts ; cdz.ts ZIP/.cdz §5.3-§6.3 ; figerUrl.ts — URL figée web)
│   └── data/            # Données de l'app (carte.ts généré)
├── scripts/             # Outils + contrôles (extraire-carte-svg.mjs, verifier-figer-url.mjs)
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

Aucune route : une **pile de fenêtres en mémoire** (`src/navigation/navigateur.ts`),
miroir des anciens ordres router (`naviguer`≈push, `remplacer`≈replace,
`retourner`≈back). L'entrée est TOUJOURS la fenêtre « chargement » (splash) ;
le parcours se joue ensuite sur les boutons du jeu.

| Fenêtre | Fichier | Rôle |
| --- | --- | --- |
| `chargement` | `src/ecrans/chargement.tsx` | Entrée de l'app (2 tâches factices de 2 s) |
| `connexion` | `src/ecrans/connexion.tsx` | Connexion / création de compte |
| `principal` | `src/ecrans/principal.tsx` | Fenêtre principale — carte + hotspots + bandeau pub |
| `usine` | `App.tsx` + `components/usine-ecran(.web)` | Scanner + fabrication de carte (caméra natif / saisie web) |
| `carte` | `App.tsx` + `components/carte-detail.tsx` | Détail d'une carte (`carteId` porté par la fenêtre — cache local ou serveur) |
| `maison` `mairie` `boutique` `arene` | `App.tsx` + composants | Collection / infos perso / fenêtres vierges |

Flux : `chargement` exécute ses tâches puis `remplacer(connexion|principal)` —
le splash est retiré de la pile, donc impossible d'y revenir au bouton retour.
Depuis `connexion`, `remplacer(principal)` ; les zones de la carte et le menu
latéral ouvrent les fenêtres via `naviguer` ; le bouton retour (barre d'en-tête
maison `EnteteEcran`, ou bouton système Android) dépile via `retourner`.

## Web — URL figée à la racine (exigence produit, 2026-11-03 / 2026-11-11)

Dans le navigateur, **l'URL ne doit jamais quitter la base de l'app** : aucune
route (`…/login`, `…/maison`, `…/carte/4…`) n'y apparaît, et la construction des
fenêtres repart toujours du splash. Depuis la fin du router, **rien n'écrit
jamais d'entrée d'historique** — la navigation est un état React — donc
l'adresse ne peut pas bouger d'elle-même. Le dispositif restant (« web only »,
sans effet en natif) :

- `src/utils/figerUrl.ts` (`verrouillerUrlRacine`), posé au chargement du bundle
  par `index.ts`, AVANT le montage de l'app : réécriture de
  `history.pushState` / `history.replaceState` pour que toute écriture (lib
  tierce, code futur) cible la racine `/` ; et **lien profond tapé à la main** :
  l'entrée d'historique est remise à `/` en une seule écriture — le flux repart
  du splash (auto-connexion par tokens → principal, cf. `screens/chargement.md`).
  Idempotent (marqueur sur `window`), silencieux hors navigateur.

Vérifié headless Chrome + DevTools le 2026-11-03 (époque expo-router) :
deep link `/maison` → URL `/` + connexion après splash ; navigation réelle debug
→ principal puis menu latéral → maison, URL toujours `/` ; `pushState` /
`replaceState` réécrits vers `/` (state conservé). Contrôles hors navigateur :
`node --experimental-strip-types scripts/verifier-figer-url.mjs` (6 cas du
module : ramène deep link, réécriture push/replace, idempotence, cas racine,
silence hors navigateur).

Note annexe — warning `useNativeDriver` (Animated) : absent sur web (module natif
manquant) → `menu-lateral.tsx` pose `useNativeDriver: Platform.OS !== 'web'` ;
natif inchangé (plus le message « Falling back to JS-based animation »).
Export statique (`npx expo export --platform web`) : la page servie est
`index.html` — à l'image du web en dev, aucun autre chemin n'a d'existence
côté hébergeur (aucune route ne doit être adressable de toute façon).

## État global (Redux Toolkit)

- `src/store/store.ts` — `store` + `persistor` : persistance **AsyncStorage** (= localStorage sur le web) via redux-persist, clé `racine`, `whitelist: ['utilisateur']` — seule la tranche utilisateur survit au redémarrage.
- `src/store/utilisateur.ts` — tranche `utilisateur` conforme au serveur pyCodebara2 : `idUser` (`id`), `nickname`, `mail`, `amount`, `hash` (champ interne opaque), **`apiToken`** (`API_TOKEN` long) + **`requestToken`** (`API_REQUEST_TOKEN` une-requête, rotatif) ; actions `seConnecter` / `renouvelerRequestToken` (rotation §3.3) / `modifierProfil` (payload partiel — mairie) / `seDeconnecter` ; export `UTILISATEUR_DEBUG` (bypass debug : id `-9999`, nickname `GOD`, hash `null`, tokens `null`, mail `codebara@free.fr`). Le mot de passe clair n'est jamais stocké (envoi : `sha256Hex(mail_exact + motDePasseClair)`, §3.2 — `src/utils/hash.ts`).
- `src/services/api.ts` — client HTTP du serveur (contrat : `integration-client.md` à la racine) : auth login/pass (`GET /user/auth` — §5.2a), auth par tokens (§5.2b), `POST /user` (création — §5.1), `POST /user/renew-password` (§5.9), `PUT /user` (maj profil mairie — §5.10), `POST /card` (génération depuis un code-barres — §5.3, timeout dédié **150 s**, réponse synchrone `card` ou asynchrone `cardid` seul), `GET /card` (liste — §5.4), `GET /card/{id}` (une carte + son fichier — §5.5), `PUT /card/name` (renommage — §5.7, réponse `{cid, card}` sans checksum) ; appels protégés **sérialisés** (§9.1), **rotation** du `API_REQUEST_TOKEN` sur tout succès (§3.3), **mort de session** (« Invalid REQUEST TOKEN ») ET **sortie volontaire** (`quitterSession`, déconnexion mairie) = reset tranche + purge + fenêtre connexion (`remplacer`, navigateur), timeout 10 s (hors génération, §2), base URL `EXPO_PUBLIC_SERVER_URL`.
- `src/services/collection.ts` — **cache collection local** (§6.6) : archives `.cdz` + index des noms, dans un répertoire par id utilisateur — natif : `expo-file-system` API nouvelle (`Paths.document/<idUser>/<carteId>.cdz`, sandbox privé : accessible uniquement par l'application) ; web : **IndexedDB** custom (base `codebara-cdz`, expo-file-system est natif-only). Méthodes : `lireIndex`/`majIndex`/`enregistrerCarte`/`lireCarteLocale`/`supprimerCarte` (destruction d'une archive au hash non conforme, cf. verification.ts).
- `src/services/verification.ts` — **vérification de la collection au retour de connexion** (décision produit 2026-11-12, exécutée par le splash) : `GET /card` → pour chaque carte présente en cache local, `sha256(archive)` comparé au `cardHash` serveur — écart = archive corrompue/modifiée → modal de destruction (unique action) dans le splash puis `supprimerCarte` ; en fin de course, re-téléchargement des seules cartes **absentes ou détruites** (`GET /card/{id}` §5.5, validation §6.3 avant stockage + maj index). Progression poussée à l'appelant (libellé « récupération des cartes » du splash).
- `src/components/visuel-carte.tsx` — **visuel 3D d'une carte `.cdz` en vitrine de musée** (réception d'une carte fabriquée en usine + fenêtre détail) : la carte (faces `front.png`/`back.png` sur un plan à perspective) est mise en valeur sur un **pupitre** (dalle `#3c414d`, fût, socle) dans une vitrine sombre (`#191d24`) éclairée par un **spot plafonnier** (faisceau triangulaire dessiné par bordures + halos chauds) ; l'**ombre de la carte glisse sur la dalle** avec la rotation (`-sin(rotationY)`). Glissement horizontal = rotation complète illimitée (dos visible passé 90°, `backfaceVisibility`), glissement vertical = inclinaison bornée ±30° qui révèle les **reflets de lumière** (bandes translucides pures RN — glissement avec la rotation via sin, intensité avec l'inclinaison ; aucune dépendance native, web + natif). Le PanResponder (pointeur/doigt, posé sur toute la vitrine) garde la pose au relâchement ; dans une `ScrollView`, un geste vertical passe à la liste (capture à partir d'un déplacement réel). Toute la géométrie dérive de la largeur de la carte (paramètre `largeur`).
- `src/utils/cdz.ts` — pipeline `.cdz` : signature ZIP (garde-fou anti tar.xz §5.7), unzip **jszip**, `sha256(bytes)` via `expo-crypto.digest` (contrôle global == `checksum` == `cardHash`, §6.3), contrôles `hashs.json` internes (front/back/perso/datas), `datas.json` parsing tolérant (§6.4). Décision produit : **ZIP uniquement**. `extraireApercu(bytes)` — extraction **allégée** (front.png + datas.json, sans les contrôles §6.3) pour les aperçus de la grille maison ; les contrôles complets restent réservés à la fenêtre détail. `src/utils/base64.ts` — encode/decode pur JS (Hermes).
- `src/store/hooks.ts` — hooks typés `useAppDispatch` / `useAppSelector` : à utiliser partout, jamais les hooks bruts de react-redux.
- Montage : `SafeAreaProvider` + `Provider` + `PersistGate` dans `App.tsx` (registerRootComponent ne monte pas de SafeAreaProvider — c'était expo-router qui le faisait).
- Redux DevTools : web → extension navigateur (RTK l'active par défaut) ; natif en dev → `@redux-devtools/remote` branché sur le store (`src/store/store.ts`, chemin `__DEV__` non-web), moniteur `npx --yes @redux-devtools/cli redux-devtools` sur le port 8000 et, pour un téléphone physique, `EXPO_PUBLIC_DEVTOOLS_HOST=<IP LAN>` au démarrage. Hermes n'ayant pas le global `crypto` (Web Crypto) requis par `uuid` — transport devtools via socketcluster-client — le store installe un polyfill `global.crypto` via `expo-crypto` **avant** le `require('@redux-devtools/remote')`.
- Déconnexion (bouton du menu latéral, fenêtre principale uniquement) : `dispatch(seDeconnecter())` + `persistor.purge()` puis `remplacer(connexion)` (`src/navigation/navigateur.ts`).

## Dossiers natifs

`ios/` et `android/` n'existent pas : le projet marche en **génération continue (CNG)**. Ces dossiers sont générés et ne doivent jamais être créés ni édités à la main — toute configuration native passe par `app.json` et les config plugins.
