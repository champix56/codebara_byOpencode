# Chargement

Fenêtre : **entrée de l'app** — fichier `src/ecrans/chargement.tsx` (trois modes : `auto` au démarrage, `post-connexion` après le bouton Connexion, `debug` après le bouton GOD)

## Rôle

Splash piloté par les **vraies étapes** du démarrage (plus de minuteur artificiel) — après l'hydratation du store (`PersistGate` : montée seulement une fois rehydrated) :

1. **Connexion** (libellé affiché, min. 900 ms de lisibilité) :
   - mode `auto` : libellé « **tentative de connexion auto** » — si des tokens sont persistés → `authentifierParTokens` (`GET /user/auth` §5.2b) ; données fraîches → `seConnecter` (tokens conservés) ; couple refusé → `seDeconnecter` + connexion ; panne → connexion (tokens non consommés conservés). Sans tokens → connexion directe.
   - mode `post-connexion` (retour du bouton « Connexion » de la fenêtre connexion) : libellé « **connexion** » — la session vient d'être validée par `authentifierParLogin`, aucun appel redondant.
   - mode `debug` (bouton GOD) : compte local sans tokens, libellé « **connexion** » ; l'étape 2 est sautée mais l'étape saison reste obligatoire (surtout sur le web).
2. **« récupération des cartes »** (sautée en mode `debug`) : `verifierEtRecuperer` (cf. `src/services/verification.ts`) — lecture `GET /card` (§5.4), pour chaque archive locale `sha256` du fichier **complet** vérifié contre le serveur via **`GET /card/check`** (§5.6) ; puis téléchargement des cartes **absentes ou supprimées** (`GET /card/{id}` §5.5) : stockage immédiat, validation §6.3 avant stockage, **puis** vérification serveur du checksum du fichier stocké (`/card/check`).
3. **« saison d'affichage »** (v0.0.12, **avant** la modal éventuelle — celle-ci navigue directement) : `chargerSaisonAffichage` (cf. `src/services/saison.ts`, format `cds-format.md`) — `.cds` local vérifié par son sha256 via `GET /season/check` (mobile) ou `GET /season` (web). Fraction 98 %.
   - **Mobile** : repli saison embarquée sur tout incident — **ne bloque jamais** la connexion.
   - **Web (v0.0.16)** : aucune saison embarquée de secours — on attend `GET /season` par passes de 3 s (10 essais, libellé « attente de la saison ») jusqu'à obtenir une saison complète ; sinon écran d'erreur + « Réessayer ». La principale reste **inaccessible** tant que la saison serveur n'est pas arrivée, y compris en mode `debug`.
4. Succès → `remplacer({ nom: 'principal' })` ; échec d'auto-connexion → `remplacer({ nom: 'connexion' })`.

## Structure visuelle

- Fond blanc, œuf centré (`assets/icon.png`, 220 px).
- En bas : libellé de l'étape + « … » (gris 14 px), compteur `n/total` pendant la récupération, **barre de progression** (240 px, piste #e5e7eb, remplissage vert #43a047) dont la fraction suit les phases (connexion 10 % → vérification 35-65 % → téléchargement 70-97 % → saison 98 %), spinner vert.
- **Erreur de récupération** : message rouge + bouton « Réessayer » (relance le même parcours).
- **Erreur saison (web)** : message « La saison n’est pas encore arrivée — réessaie dans un instant. » + bouton « Réessayer » ; la barre reste à 98 %.

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
- Une erreur d'appel (`/card/check` injoignable, etc.) interrompt le parcours avec l'écran d'erreur — **on ne détruit jamais une archive sur un doute**. L'étape **saison** ne bloque jamais sur mobile (repli embarqué), mais **bloque sur web** jusqu'à réception de la saison serveur (v0.0.16).
- Les cartes corrompues ne sont annoncées dans la modal qu'**après** l'étape saison : son bouton OK mène à la principale, qui doit rester inaccessible sur le web si la saison n'est pas là.

## Navigation

- Entrée de l'application : **toujours la première fenêtre de la pile** — aucune URL ne peut sélectionner autre chose.
- La fenêtre connexion relance ce splash via `remplacer({ nom: 'chargement', mode: 'post-connexion' })` ; le bouton debug (GOD) via `remplacer({ nom: 'chargement', mode: 'debug' })` (cf. connexion.md).
- Sortie : `remplacer({ nom: 'connexion' })` ou `{ nom: 'principal' }` — l'écran est retiré de la pile (pas de retour arrière vers lui).
- Le service global de notifications (`src/hooks/use-notifications-systeme.ts`) est monté sous `PersistGate`, indépendamment de cette fenêtre : un clic notification peut donc remplacer le splash par `poste` ou `connexion`.

## Notes

- Vérification validée navigateur headless (CDP, 2026-11-12) : libellés des deux étapes, modal (carte par défaut + raison + unique bouton), destruction → re-téléchargement, grille maison complète ensuite.
- **Web (2026-11-11)** — l'écran est TOUJOURS le premier affiché : toute adresse tapée est ramenée à « / » au chargement du bundle (`verrouillerUrlRacine`, `src/utils/figerUrl.ts`).
