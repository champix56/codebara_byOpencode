# Fenêtre maison

## Rôle

Route `/maison` : gestion du compte courant — formulaire « informations utilisateur » pour modifier le **nickname** et le **mot de passe**, écrits directly dans la tranche utilisateur **persistée** du store Redux (placeholder local, en attente du serveur).

## Structure visuelle

- Fond blanc, contenu centré dans un `ScrollView` (clavier géré par `KeyboardAvoidingView` padding sur iOS).
- Titre « Mon compte » + sous-titre gris.
- Bloc infos **en lecture seule** du compte : mail (`codebara@free.fr` pour le compte debug) et identifiant (`user #−9999`…) — « — » si tranche vide.
- Champs, largeur max 320 px :
  - « Nickname » (`TextInput` prérempli avec la valeur actuelle de la tranche, `autoCapitalize="none"`) ;
  - « Nouveau mot de passe » (`secureTextEntry`, facultatif) ;
  - « Confirmation du mot de passe » (`secureTextEntry`).
- Aide grise : « Laissez les champs de mot de passe vides pour conserver l’actuel. »
- Erreur rouge sous les champs si la confirmation ne correspond pas : « Les mots de passe ne correspondent pas. »
- Bouton principal vert (#43a047) « Enregistrer » — désactivé (pastille verte pâle) tant que nickname est vide, la confirmation ne suit pas, ou pendant le calcul d’empreinte.
- Message d’état sous le bouton : vert « Modifications enregistrées. » (ou rouge « Échec du calcul de l’empreinte. »).

## États

- Champs locaux : `nickname`, `motDePasse`, `confirmation`, `message`, `enEnregistrement` — valeurs initiales lues à l’ouverture depuis `etat.utilisateur`.
- Soumission : `dispatch(modifierProfil({ nickname, hash? }))` — `hash` **omis** si les champs de mot de passe sont vides (l’empreinte actuelle est conservée) ; les champs de mot de passe sont vidés après succès, nickname conservé.
- Empreinte : SHA-256 du mot de passe via expo-crypto (`src/utils/hash.ts`) — asynchrone, l’attente est couverte par `enEnregistrement` qui désactive le bouton.

## Navigation

- Entrée : tap la zone maison sur la carte ou le menu latéral (fenêtre principale).
- Sortie : bouton retour de la barre de navigation native → `router.back()`. En natif, le geste système s’ajoute.

## Notes

- Action de tranche : `modifierProfil` (payload partiel `nickname` / `hash`) dans `src/store/utilisateur.ts` — merge paresseux, les champs absents préservent l’existant ; changement persisté au redémarrage (redux-persist).
- Aucune vérification du mot de passe actuel (impossible sans serveur) ; la vraie procédure (contrôle du mot de passe en cours, changement côté serveur, token renouvelé) arrivera avec l’API.
- L’écran est unique pour toutes les plateformes : un `TextInput` fonctionne aussi bien sur le web (contrairement au scanneur usine, qui a une variante `.web.tsx`).
