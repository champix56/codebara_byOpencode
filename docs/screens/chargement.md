# Chargement

Fenêtre : **entrée de l'app** — fichier `src/ecrans/chargement.tsx` (deux modes : `auto` au démarrage, `post-connexion` après le bouton Connexion)

## Rôle

Splash piloté par les **vraies étapes** du démarrage (plus de minuteur artificiel) — après l'hydratation du store (`PersistGate` : montée seulement une fois rehydrated) :

1. **Connexion** (libellé affiché, min. 900 ms de lisibilité) :
   - mode `auto` : libellé « **tentative de connexion auto** » — si des tokens sont persistés → `authentifierParTokens` (`GET /user/auth` §5.2b) ; données fraîches → `seConnecter` (tokens conservés) ; couple refusé → `seDeconnecter` + connexion ; panne → connexion (tokens non consommés conservés). Sans tokens → connexion directe.
   - mode `post-connexion` (retour du bouton « Connexion » de la fenêtre connexion) : libellé « **connexion** » — la session vient d'être validée par `authentifierParLogin`, aucun appel redondant.
2. **« récupération des cartes »** : `verifierEtRecuperer` (cf. `src/services/verification.ts`) — lecture `GET /card` (§5.4), pour chaque archive locale `sha256` du fichier **complet** vérifié contre le serveur via **`GET /card/check`** (§5.6) ; puis téléchargement des cartes **absentes ou supprimées** (`GET /card/{id}` §5.5) : stockage immédiat, validation §6.3 avant stockage, **puis** vérification serveur du checksum du fichier stocké (`/card/check`).
3. Succès → `remplacer({ nom: 'principal' })` ; échec d'auto-connexion → `remplacer({ nom: 'connexion' })`.

## Structure visuelle

- Fond blanc, œuf centré (`assets/icon.png`, 220 px).
- En bas : libellé de l'étape + « … » (gris 14 px), compteur `n/total` pendant la récupération, **barre de progression** (240 px, piste #e5e7eb, remplissage vert #43a047) dont la fraction suit les phases (connexion 10 % → vérification 35-65 % → téléchargement 70-97 %), spinner vert.
- **Erreur de récupération** : message rouge + bouton « Réessayer » (relance le même parcours).

## Modal d'avertissement (cartes corrompues)

Exigence produit **2026-11-17** (remplace la modal de destruction par carte du
2026-11-12) : une archive dont le checksum est refusé par `/card/check` est
**supprimée automatiquement** du stockage et re-téléchargée — **sans pause ni
décision utilisateur**. En fin de parcours, si des cartes ont été touchées,
une modal unique :

- **carte par défaut** (cadre gris, ⚠, « Carte #id » ou le nombre de cartes) ;
- **la liste** : « #id — raison » (checksum refusé par le serveur,
  téléchargement refusé, archive non conforme…) + « Elles ont été supprimées
  du stockage et re-téléchargées. » ;
- **un unique bouton « OK »** — le splash ne navigue vers la fenêtre
  principale qu'après sa fermeture.

## États

- `libelle` (étape affichée), `progression` { phase, faites, total }, `fraction` (barre), `corrompues` (liste à annoncer dans la modal finale), `erreur`.
- Lancement automatique unique à la montée (`lancementRef`) ; « Réessayer » ré-arme et relance (les tokens relus du store sont à jour après rotation §3.3).
- `ErreurSession` : le service a déjà purgé + navigué vers la connexion — l'écran ignore l'erreur.
- Une erreur d'appel (`/card/check` injoignable, etc.) interrompt le parcours avec l'écran d'erreur — **on ne détruit jamais une archive sur un doute**.

## Navigation

- Entrée de l'application : **toujours la première fenêtre de la pile** — aucune URL ne peut sélectionner autre chose.
- La fenêtre connexion relance ce splash via `remplacer({ nom: 'chargement', mode: 'post-connexion' })` (cf. connexion.md).
- Sortie : `remplacer({ nom: 'connexion' })` ou `{ nom: 'principal' }` — l'écran est retiré de la pile (pas de retour arrière vers lui).

## Notes

- Vérification validée navigateur headless (CDP, 2026-11-12) : libellés des deux étapes, modal (carte par défaut + raison + unique bouton), destruction → re-téléchargement, grille maison complète ensuite.
- **Web (2026-11-11)** — l'écran est TOUJOURS le premier affiché : toute adresse tapée est ramenée à « / » au chargement du bundle (`verrouillerUrlRacine`, `src/utils/figerUrl.ts`).
