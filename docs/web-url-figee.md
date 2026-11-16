# Web — URL figée à la racine (exigence produit, 2026-11-03 / 2026-11-11)

Dans le navigateur, **l'URL ne doit jamais quitter la base de l'app** : aucune
route (`…/login`, `…/maison`, `…/carte/4…`) n'y apparaît, et la construction des
fenêtres repart toujours du splash. Depuis le 2026-11-15, l'app écrit bien des
**entrées d'historique** (une par niveau de pile, via `historique-web.ts` — cf.
`navigation.md`) pour que le ‹ du navigateur revienne à la fenêtre précédente,
mais TOUJOURS vers la racine `/` : aucune URL ne révèle la fenêtre. Le
dispositif restant (« web only », sans effet en natif) :

- `src/utils/figerUrl.ts` (`verrouillerUrlRacine`), posé au chargement du bundle
  par `index.ts`, AVANT le montage de l'app : réécriture de
  `history.pushState` / `history.replaceState` pour que toute écriture (lib
  tierce, code futur, **entrées d'historique de `historique-web.ts`**) cible la
  racine `/` ; et **lien profond tapé à la main** :
  l'entrée d'historique est remise à `/` en une seule écriture — le flux repart
  du splash (auto-connexion par tokens → principal, cf. `screens/chargement.md`).
  Idempotent (marqueur sur `window`), silencieux hors navigateur — la garde est
  `Platform.OS === 'web'` (+ `typeof window`) : en natif `window` existe (alias
  du global) mais sans `history`, et le simple `typeof window` laissait passer
  Android au démarrage (TypeError sur `window.history.pushState`, corrigé le
  2026-11-12).

Vérifié headless Chrome + DevTools le 2026-11-03 (époque expo-router) :
deep link `/maison` → URL `/` + connexion après splash ; navigation réelle debug
→ principal puis menu latéral → maison, URL toujours `/` ; `pushState` /
`replaceState` réécrits vers `/` (state conservé). Contrôles hors navigateur :
`node --experimental-strip-types scripts/verifier-figer-url.mjs` (6 cas du
module : ramène deep link, réécriture push/replace, idempotence, cas racine,
silence hors navigateur).

## Notes web annexes

- Warning `useNativeDriver` (Animated) : absent sur web (module natif manquant)
  → `menu-lateral.tsx` pose `useNativeDriver: Platform.OS !== 'web'` ; natif
  inchangé (plus le message « Falling back to JS-based animation »).
- Export statique (`npx expo export --platform web`) : la page servie est
  `index.html` — à l'image du web en dev, aucun autre chemin n'a d'existence
  côté hébergeur (aucune route ne doit être adressable de toute façon).
