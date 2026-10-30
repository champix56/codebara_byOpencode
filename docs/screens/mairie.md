# Fenêtre mairie

## Rôle

Route `/mairie` : accès aux **informations personnelles** du compte et à leur **modification** :
- **nickname** — écrit dans la tranche utilisateur **persistée** (la synchronisation serveur attendra `PUT /user`, absent à ce jour — contrat §9.3 / §12.1) ;
- **mot de passe** — via le serveur `POST /user/renew-password` (§5.9) : un mot de passe **aléatoire** est généré et envoyé par e-mail ; l'ancien cesse de fonctionner pour la connexion. (Le serveur ne permet pas de *choisir* son mot de passe : cette limite est contractuelle, contournement client interdit.)

Originie : la modification du profil est venue depuis la fenêtre maison, re-dédiée à la collection de cartes.

## Structure visuelle

- Fond blanc, contenu centré dans un `ScrollView` (clavier géré par `KeyboardAvoidingView` padding sur iOS).
- Titre « Ma mairie » + sous-titre gris.
- Bloc infos **en lecture seule** (fond gris arrondi) : `Mail`, `Identifiant` (`user #…`), `Monnaie` (`amount`, valeur serveur) — « — » si tranche vide.
- Champs, largeur max 320 px :
  - « Nickname » (`TextInput` prérempli avec la valeur actuelle de la tranche, `autoCapitalize="none"`) ;
- Bouton principal vert « Enregistrer » (nickname) — désactivé si vide ou enregistrement en cours.
- Section « Mot de passe » :
  - bouton vert « Recevoir un nouveau mot de passe par e-mail » (désactivé si aucun mail en tranche) ;
  - au premier appui, **conformation inline** : bloc explanation (adresse visée, « ton mot de passe actuel cessera de fonctionner ») + `Confirmer` (rouge) / `Annuler` (contour) ;
  - pendant l'appel : « Demande envoyée au serveur… » ;
- Message d'état partagé sous le formul: vert (« Modifications enregistrées. » / « Mot de passe renouvelé… » / message ambigu 403) / rouge (réseau).
- Note grise : le nickname modifié est conservé **sur cet appareil** ; synchronisation serveur à venir.

## États

- `nickname`, `message`, `enEnregistrement` (initiaux via `etat.utilisateur`, persisté).
- `etapeMdp` : `'repos' \| 'confirme' \| 'envoi'` — la double confirmation évite d'invalider un mot de passe par un tap accidentel.
- Soumission nickname : `dispatch(modifierProfil({ nickname }))` — payload partiel, `hash` non touché ; **aucun appel réseau** pour ce champ.
- Soumission mot de passe : `renouvelerMotDePasse(utilisateur.mail)` (`src/services/api.ts`) → `POST /user/renew-password {"mail"}` :
  - succès `{"renewed": true}` **sans token** — pas de rotation ; la session RESTE valable (les tokens ne dépendent pas du mot de passe, §5.9) ;
  - échec **403 `Forbidden`** (volontairement ambigu : mail mal formé OU compte inconnu) → message ambigu « si le compte est reconnu… » — pas d'oracle d'existence ;
  - autre erreur (réseau…) → message rouge.
- Avec le serveur en `DEBUG=True` : l'e-mail **n'est pas envoyé** — le nouveau mot de passe est imprimé dans le log du serveur (contrat §12.1).

## Navigation

- Entrée : bouton **« Mairie » du menu latéral** de la fenêtre principale (pas de zone `data-action` mairie sur la carte actuelle).
- Sortie : bouton retour de la barre de navigation native → `router.back()` ; geste iOS en natif.

## Notes

- Le pseudo-choix de mot de passe (saisie d'un mot de passe personnalisé) arrivera quand le serveur aura `PUT /user` — suivre `integration-client.md` (journal §11).
- La fenêtre est unique pour toutes les plateformes (aucune variante `.web.tsx` utile).
