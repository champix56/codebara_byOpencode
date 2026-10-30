# Chargement

Route : `/` — fichier `src/app/index.tsx`

## Rôle

Écran de démarrage de l'application. Exécute à l'ouverture **deux tâches de chargement factices, 2 secondes chacune, dans cet ordre** :

1. `auto-connexion`
2. `recuperation de la collection`

Intitulés exacts à conserver tels quels (textes visibles à l'utilisateur). **Faux chargement placeholder** — à remplacer par de vrais appels quand un backend existera ; les libellés et durées sont centralisés en constantes (`TASKS`, `TASK_DURATION_MS`) en tête du fichier.

## Structure visuelle

- Fond blanc, plein écran.
- Œuf centré verticalement/horizontalement (image `assets/icon.png`, 220 px, `contain`).
- En **bas** de l'écran, bloc centré :
  - un texte juste au-dessus de la barre : la tâche en cours + « … » (ex. `auto-connexion…`), gris #6b7280, 14 px ;
  - une **barre de progression** (240 px de large, 6 px de haut, coins arrondis, piste #e5e7eb, remplissage vert #43a047) avançant linéairement sur les 4 s totales.

## États

- `progress` : 0 → 1, rafraîchi toutes les 50 ms (calcul à partir de `Date.now()`, pas cumulé — résiste aux suspensions).
- Tâche affichée : `TASKS[floor(progress × 2)]` (clampée).
- Navigation déclenchée une seule fois (ref `navigated`) dès que `progress ≥ 1`.

## Navigation

- Point d'entrée de l'app (première route du Stack racine).
- Sortie unique : `router.replace('/login')` à la fin des tâches → l'écran est **retiré de la pile** (bouton retour impossible vers lui).

## Notes

- L'interval est nettoyé à l'unmount (pas de fuite, pas de navigation en double).
- L'image chargée est la même source que l'icône de l'app (`assets/icon.png`, l'œuf).
