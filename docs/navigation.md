# Navigation — pile de fenêtres (aucune route)

L'app est une **SPA sans router et sans URL** (exigence produit 2026-11-11 : aucun
chemin ne doit accéder à une page ou une construction particulière). Navigation
par **pile de fenêtres en mémoire** (`src/navigation/navigateur.ts`), miroir des
anciens ordres router (`naviguer`≈push, `remplacer`≈replace, `retourner`≈back).

- `naviguer`   — empile une fenêtre (bouton retour actif) ;
- `remplacer`  — remplace la fenêtre courante sans empiler (chargement → connexion/principal, connexion → principal, déconnexion) ;
- `retourner`  — dépile vers la fenêtre précédente (`false` à la racine : sur Android, le bouton système rend la main à l'OS).

L'entrée est TOUJOURS la fenêtre « chargement » (splash) ; le parcours se joue
ensuite sur les boutons du jeu. Le service `api.ts` (hors React) et les
composants appellent ce module directement ; `App.tsx` s'abonne
(`enregistrerEcouteur`) et rend la fenêtre courante. Aucune écriture
d'historique navigateur.

| Fenêtre | Fichier | Rôle |
| --- | --- | --- |
| `chargement` | `src/ecrans/chargement.tsx` | Entrée de l'app (splash par étapes réelles, cf. `screens/chargement.md`) |
| `connexion` | `src/ecrans/connexion.tsx` | Connexion / création de compte |
| `principal` | `src/ecrans/principal.tsx` | Fenêtre principale — carte + hotspots + bandeau pub |
| `usine` | `App.tsx` + `components/usine-ecran(.web)` | Scanner + fabrication de carte (caméra natif / saisie web) |
| `carte` | `App.tsx` + `components/carte-detail.tsx` | Détail d'une carte (`carteId` porté par la fenêtre) |
| `maison` `mairie` `boutique` `arene` | `App.tsx` + composants | Collection / infos perso / fenêtres vierges |

Flux : `chargement` exécute ses tâches puis `remplacer(connexion|principal)` —
le splash est retiré de la pile, donc impossible d'y revenir au bouton retour.
Depuis `connexion`, `remplacer(principal)` ; les zones de la carte et le menu
latéral ouvrent les fenêtres via `naviguer` ; le bouton retour (barre d'en-tête
maison `EnteteEcran`, ou bouton système Android) dépile via `retourner`.

Après l'enregistrement du nom d'une carte fabriquée, la pile empile le **détail
carte** au-dessus de l'usine (exigence produit 2026-11-15).

## Web — historique navigateur aligné sur la pile

Le ‹ du navigateur (bouton chrome, Alt+gauche, geste balayage) ne quitte plus
l'app : `src/utils/historique-web.ts` pose **une entrée d'historique par niveau
de pile** (`{ profondeur }`, URL toujours `/` via les réécritures de
`figerUrl.ts`). `popstate` replie/remonte la pile pour rejoindre la profondeur
de l'entrée (`retourner` / `remonter` — les fenêtres dépilées sont gardées dans
`pileAnnulees` par `navigateur.ts`) ; sous la racine (state null), une entrée
racine est repoussée — le joueur reste dans l'app. Le ‹ de l'en-tête (web)
appelle `history.back()` : un retour = une entrée consommée, l'en-tête et le
navigateur restent alignés. (`BackHandler` de react-native-web est un no-op qui
loggue une erreur — l'abonnement Android est gardé natif-only dans `App.tsx`.)
