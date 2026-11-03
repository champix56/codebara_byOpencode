# Fenêtre mairie

Route : `/mairie` — fichier `src/components/mairie-ecran.tsx` (monté par `src/app/mairie.tsx`)

## Rôle

Informations **personnelles** du compte et leur **modification** via `PUT /user`
(contrat §5.10, tokens requis) :
- **nickname** — envoyé au serveur, tranche rechargée depuis la réponse ; sans session (compte debug GOD, tokens nuls) la sauvegarde reste **locale** (tranche persistée) ;
- **mot de passe** — **saisi par l'utilisateur** : validé côté client (§5.10 — le serveur ne reçoit que le hash), envoyé `PUT /user {"password": SHA256(mail_courant + clair)}`, et sur **200 → déconnexion complète** : l'utilisateur se reconnecte avec le nouveau mot de passe.

## Structure visuelle

- Fond blanc, contenu centré dans un `ScrollView` (clavier géré par `KeyboardAvoidingView` padding sur iOS).
- Titre « Ma mairie » + sous-titre gris.
- Bloc infos en lecture seule (fond gris arrondi) : `Mail`, `Identifiant` (`user #…`), `Monnaie` (`amount`, valeur serveur) — « — » si tranche vide.
- Largeur max 320 px :
  - « Nickname » : `TextInput` prérempli (`autoCapitalize="none"`) + bouton vert « Enregistrer » ;
  - « Nouveau mot de passe » : `TextInput` **masqué** (`secureTextEntry`) dans une ligne avec bouton-lien vert **« Afficher » / « Masquer »** à droite (bascule `afficherMdp`) ;
  - **indicateur de niveau** sous la saisie : barre de 5 segments (un par règle, colorée verte/orange/rouge quand remplie) + libellé `Faible` (rouge #ef4444) / `Moyen` (orange #f59e0b) / `Fort` (vert #22c55e) — 0-2 règles = Faible, 3-4 = Moyen, 5 = Fort ;
  - **checklist des 5 règles** (pastille verte/grise + libellé) : `Un caractère spécial (!, ?, @…)`, `Une minuscule`, `Une majuscule`, `Un chiffre`, `Plus de 7 caractères` ;
  - bouton vert « Enregistrer le mot de passe » — **désactivé** (vert pâle) tant que les 5 règles ne sont pas toutes respectées, ET tant qu'il n'y a pas de session serveur, ET pendant l'envoi (libellé « Envoi… »).
- Message d'état partagé : vert (« Modifications enregistrées sur le serveur. » pour le nickname) / rouge (`Serveur injoignable (…)`, erreurs serveur).
- Note grise : sans session serveur (compte debug), le mot de passe reste inchangé.

## États

- `nickname`, `message`, `enEnregistrement` — initiaux via la tranche persistée `etat.utilisateur`.
- `motDePasse`, `afficherMdp`, `enEnvoiMdp` — le clair vit **uniquement dans l'état local du composant** (jamais dans Redux ni la persistance).
- `evaluerMotDePasse(clair)` (`src/utils/motDePasse.ts`) : 5 règles (spécial, minuscule, majuscule, chiffre, longueur > 7) → `nbRespectees`, `toutesRespectees`, `niveau`. La règle de l'app est **plus stricte** que la référence serveur (≥ 7 car., pas de chiffre exigé) ; le contrat §5.10 délègue expressément la validation au client, le serveur ne vérifie que la forme du hash `[0-9a-f]{64}`.
- Pseudo : `modifierUtilisateurServeur({ nickname })` → `PUT /user` — réponse 200 = profil à jour + `API_REQUEST_TOKEN` renouvelé (rotation gérée dans `appelProtege`) → `dispatch(modifierProfil({ nickname, hash }))` depuis la réponse.
- Mot de passe : `modifierUtilisateurServeur({ motDePasseClair })` → hachage `hacherMotDePasse(mail_courant, clair)` (`src/utils/hash.ts`, §3.2) — `mail_final` = mail de session (l'écran ne change pas le mail). La promesse ne se résout **que sur 200** (`lireJson` lève sur 400/403) ;
  - **sur 200 → `quitterSession()`** (`src/services/api.ts`, exporté) : `seDeconnecter` + `persistor.purge()` + `router.replace('/login')` — déconnexion voulue même si le contrat précise que la session resterait valable (décision produit : l'utilisateur se reconnecte avec le nouveau mot de passe) ;
  - « Invalid REQUEST TOKEN » (session morte) → même gestion centralisée (le catch de l'écran ignore l'`ErreurSession`, navigation déjà enclenchée) ;
  - `Forbidden` 403 : mail mal formé / déjà utilisé / hash non conforme — théoriquement impossible ici (hash toujours en 64 hex minuscules) ; affiché en rouge si survenant.
- Sans session (GOD) : bouton mot de passe désactivé ; le nick reste sauvegardé localement (message dédié).

## Navigation

- Entrée : bouton « Mairie » du **menu latéral** de la fenêtre principale.
- Sortie normale : retour de la barre de navigation native → `router.back()`.
- Sortie après changement de mot de passe : **automatique** → `/login` (déconnexion).

## Notes

- Règle serveur ≥ 7 caractères : l'app exige **plus de 7** (≥ 8) + un chiffre — compatible, cf. validation client ci-dessus. S'aligner si le propriétaire change la règle dans `integration-client.md` (§11 journal).
- Un changement de **mail** exigerait aussi un nouveau mot de passe (contrat : le mail seul serait refusé 403 — l'ancien hash deviendrait inutilisable au prochain login) ; l'écran ne propose pas la modification du mail.
- La fenêtre est unique pour toutes les plateformes (aucune variante `.web.tsx`).
