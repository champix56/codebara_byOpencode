# Architecture

Vue d'ensemble — chaque logique détaillée vit dans son propre fichier (voir
`README.md` pour l'index complet). Objectif : ne charger que ce qui est demandé.

## Stack

| Élément | Version | Rôle |
| --- | --- | --- |
| Expo | SDK 58 (`expo ~58.0.21`) | Framework applicatif |
| React Native | 0.88.1 | Runtime mobile |
| React | 19.3.0 | UI |
| TypeScript | ~6.0.3 | Typage statique |
| jszip | 3.10.2 | Lecture des archives `.cdz` (ZIP §5.3) — caractères pure JS |
| expo-file-system | ~58 | Cache collection `<idUser>/<id>.cdz` (§6.6, natif ; web → IndexedDB custom) |
| @zxing/browser + @zxing/library | 0.2.1 / 0.23.0 | **Web uniquement** — scan caméra de codes-barres à l'usine (natif reste sur expo-camera) |
| `NOTES-VERSION.md` + `npm run maj:notes` | — | Source des notes de version + version embarquée (`src/data/notes-version.ts` généré, cf. `screens/notes-version.md`) |
| @redux-devtools/remote | ^1.0.1 | DevTools natif (dev) — cf. `etat-global.md` |

## Point d'entrée

L'app est une **SPA sans router et sans URL** (exigence produit 2026-11-11) —
modèle classique Expo :

- `package.json` — `main: "index.ts"` : point d'entrée (résolu par Expo CLI avec les extensions bare).
- `index.ts` — `registerRootComponent(App)` (doc SDK 58 : registerRootComponent) + pose du verrou d'URL web (`verrouillerUrlRacine`, cf. `web-url-figee.md`).
- `App.tsx` — composant racine : `SafeAreaProvider` + `Provider` (Redux) + `PersistGate`, rend la fenêtre courante de la pile `src/navigation/navigateur.ts` (cf. `navigation.md`).
- `app.json` — configuration Expo : nom, slug, plugins `expo-camera`, `expo-build-properties`, `./plugins/certificat-serveur.js` (TLS dev, cf. `serveur-dev-https.md`), icônes, orientation. Plus de plugin `expo-router` ni de `scheme` (aucune URL) — Expo Router a été **retiré** du projet le 2026-11-11 (dépendance, plugin, `src/app/`).

## Structure actuelle

```text
codEbara/
├── App.tsx               # Composant racine — fenêtre courante + SafeAreaProvider + Redux
├── index.ts              # Point d'entrée (main package.json) — registerRootComponent(App)
├── src/
│   ├── ecrans/           # Écrans racine : chargement (entrée), connexion, principal
│   ├── navigation/       # navigateur.ts — pile de fenêtres en mémoire (AUCUNE route)
│   ├── components/       # carte-interactive, bandeau-pub, menu-lateral, fenetre-vierge, entete-ecran, usine-ecran(.web), fabrication-carte, maison-ecran, carte-detail, visuel-carte, mairie-ecran
│   ├── services/        # api.ts (client HTTP serveur) + collection.ts (cache .cdz + index nom/saison par utilisateur) + verification.ts (hash cache ↔ serveur)
│   ├── store/           # Redux Toolkit — tranche utilisateur persistée (store, utilisateur, hooks)
│   ├── utils/           # Règles métier pures (codes-bar.ts ; hash.ts SHA-256 §3.2 ; motDePasse.ts règle §5.10 ; base64.ts ; cdz.ts ZIP/.cdz §5.3-§6.3 ; figerUrl.ts — URL figée web)
│   └── data/            # Données de l'app (carte.ts généré)
├── scripts/             # Outils + contrôles (extraire-carte-svg.mjs, verifier-figer-url.mjs, generer-certificats.sh, maj-notes-version.mjs)
├── plugins/             # Config plugins locaux (certificat-serveur.js — TLS auto-signé dev, CNG)
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

## Dossiers natifs

`ios/` et `android/` n'existent pas : le projet marche en **génération continue
(CNG)**. Ces dossiers sont générés et ne doivent jamais être créés ni édités à
la main — toute configuration native passe par `app.json` et les config plugins
(le dossier `plugins/` porte les plugins locaux du projet).

## Fichiers détaillés par logique

| Logique | Fichier |
| --- | --- |
| Pile de fenêtres / navigation | [`navigation.md`](./navigation.md) |
| Web — URL figée à la racine | [`web-url-figee.md`](./web-url-figee.md) |
| État global Redux (store, tokens, devtools, déconnexion) | [`etat-global.md`](./etat-global.md) |
| Client serveur + cache collection + vérification | [`services-serveur.md`](./services-serveur.md) |
| Pipeline archives `.cdz` | [`cdz-pipeline.md`](./cdz-pipeline.md) |
| Visuel 3D de la carte (vitrine, gestes, zoom) | [`visuel-carte-3d.md`](./visuel-carte-3d.md) |
| Serveur dev HTTPS auto-signé (certificats, plugin) | [`serveur-dev-https.md`](./serveur-dev-https.md) |
