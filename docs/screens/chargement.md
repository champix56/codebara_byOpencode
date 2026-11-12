# Chargement

Fenêtre : **entrée de l'app** — fichier `src/ecrans/chargement.tsx`

## Rôle

Écran de démarrage de l'application. Barre visuelle de 4 s (libellés « auto-connexion » puis « recuperation de la collection », et **pendant** que la barre tourne :

- si la tranche utilisateur persistée contient **un couple de tokens** (`apiToken` + `requestToken`) → **vrai contrôle de session** : `authentifierParTokens` → `GET /user/auth` par tokens (contrat pyCodebara2 §5.2b), sans rotation ;
  - données fraîches reçues → `dispatch(seConnecter(...))` (données mises à jour, tokens conservés) puis `$ remplacer({ nom: 'principal' })` — reprise de session transparente ;
  - couple refusé (session morte) → `dispatch(seDeconnecter())` + `remplacer({ nom: 'connexion' })` ;
  - panne réseau → `remplacer({ nom: 'connexion' })` (les tokens persistent tant qu'ils n'ont pas été consommés) ;
- sinon → `remplacer({ nom: 'connexion' })`.

Les libellés/la durée restent centralisés en constantes (`TASKS`, `TASK_DURATION_MS`).

## Structure visuelle

- Fond blanc, plein écran.
- Œuf centré verticalement/horizontalement (image `assets/icon.png`, 220 px, `contain`).
- En **bas** de l'écran, bloc centré :
  - un texte juste au-dessus de la barre : la tâche en cours + « … » (ex. `auto-connexion…`), gris #6b7280, 14 px ;
  - une **barre de progression** (240 px de large, 6 px de haut, coins arrondis, piste #e5e7eb, remplissage vert #43a047) avançant linéairement sur les 4 s totales.

## États

- `progress` : 0 → 1, rafraîchi toutes les 50 ms (calcul à partir de `Date.now()`, pas cumulé — résiste aux suspensions).
- Tâche affichée : `TASKS[floor(progress × 2)]` (clampée).
- Navigation déclenchée une seule fois (ref `navigated`) dès que `progress ≥ 1` — puis la reprise de session (cf. Rôle) s'ajoute de façon asynchrone.
- Réhydratation : l'écran est démontré **après** le `PersistGate` — la tranche utilisateur est déjà relue.

## Navigation

- Entrée de l'application : **toujours la première fenêtre de la pile** (`src/navigation/navigateur.ts`) — aucune URL ne peut sélectionner autre chose.
- Sortie : `$ remplacer({ nom: 'connexion' })` **ou `{ nom: 'principal' }`** à la fin des tâches (cf. Rôle) → l'écran est **retiré de la pile** (retour arrière impossible vers lui).

## Notes

- L'interval est nettoyé à l'unmount (pas de fuite, pas de navigation en double).
- L'image chargée est la même source que l'icône de l'app (`assets/icon.png`, l'œuf).
- **Web (2026-11-11)** — l'écran est TOUJOURS le premier affiché : tout deep link
  tapé dans la barre d'adresse (…/maison…) est ramené à « / » au chargement du
  bundle (`verrouillerUrlRacine`, `src/utils/figerUrl.ts`), et l'URL du navigateur
  reste à la racine pendant toute l'app (règle : `docs/architecture.md` § Web).
