# Fenêtre mairie

## Rôle

Route `/mairie` : accès aux **informations personnelles** du compte et à leur **modification** (nickname ; mot de passe à venir). La console « compte » du joueur — ceci venait de la fenêtre maison, re-dédiée à la collection de cartes.

## Structure visuelle

- Fond blanc, contenu centré dans un `ScrollView` (clavier géré par `KeyboardAvoidingView` padding sur iOS).
- Titre « Ma mairie » + sous-titre gris.
- Bloc infos **en lecture seule** (fond gris arrondi) : `Mail`, `Identifiant` (`user #…`), `Monnaie` (`amount`, valeur serveur) — « — » si tranche vide.
- Champs, largeur max 320 px :
  - « Nickname » (`TextInput` prérempli avec la valeur actuelle de la tranche, `autoCapitalize="none"`) ;
  - « Mot de passe » : zone **désactivée** (fond gris pâle) avec le libellé « Modifiable plus tard — généré par le serveur et envoyé par e-mail à la création » — en place tant que le serveur n'a pas d'endpoint de mise à jour (`PUT /user` absent, contrat §9.3 ; cf. §5.1/§12.1).
- Bouton principal vert (#43a047) « Enregistrer » (désactivé : nickname vide ou enregistrement en cours).
- Message d'état sous le bouton : vert « Modifications enregistrées. »
- Note grise : le nickname modifié est conservé **sur cet appareil** (tranche persistée) ; synchronisation serveur à venir.

## États

- Champs locaux : `nickname`, `message`, `enEnregistrement` — initiaux via `etat.utilisateur` (persisté).
- Soumission : `dispatch(modifierProfil({ nickname }))` — payload partiel, `hash` non touché.
- Pas d'appel réseau (aucun endpoint utilisateur modifiable à ce jour).

## Navigation

- Entrée : bouton **« Mairie » du menu latéral** de la fenêtre principale (pas de zone `data-action` mairie sur la carte actuelle).
- Sortie : bouton retour de la barre de navigation native → `router.back()` ; geste iOS en natif.

## Notes

- Régression volontaire : le champ de modification du **mot de passe** est inactif ici car le serveur ne permet pas encore de le changer (il est généré et envoyé par e-mail à la création ; contractuellement, un contournement client est interdit). L'app doit suivre `docs/integration-client.md` de pyCodebara2 — activer dès que `PUT /user` sort.
- La fenêtre est unique pour toutes les plateformes (aucune variante `.web.tsx` utile).
