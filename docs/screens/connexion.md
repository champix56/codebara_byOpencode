# Connexion / Création de compte

Route : `/login` — fichier `src/app/login.tsx`

## Rôle

Fenêtre **double** : sert à la fois de page de connexion et de page de création de compte. La bascule est faite par un lien cliquable en bas — un seul écran, deux modes.

## Structure visuelle

- Fond blanc, contenu centré dans un `ScrollView` (clavier géré par `KeyboardAvoidingView` padding sur iOS).
- En haut de l'écran : l'œuf (`assets/icon.png`, 130 px).
- Titre « Bienvenue sur codEbara » + sous-titre selon le mode.
- Deux champs, largeur max 320 px :
  - « Login ou username » (`autoCapitalize="none"`, `autoCorrect={false}`) ;
  - « Mot de passe » (`secureTextEntry`).
- Bouton principal vert (#43a047) — libellé selon le mode : « Connexion » ou « Créer mon compte ».
- Lien souligné vert (#2e7d32) sous le bouton : `Pas encore de compte ? Créer un compte` ↔ `Déjà un compte ? Se connecter`.

## États

- `mode` : `'login' | 'signup'` — conditionne libellés du bouton, sous-titre et lien.
- `identifiant`, `motDePasse` : valeurs des champs.
- Bouton désactivé (vert pâle #a5d6a7) tant que l'un des champs est vide (`canSubmit`).
- `soumettre()` : **TODO** — à brancher sur l'authentification (mode login → connexion, signup → création). Aucun effet réel aujourd'hui.

## Navigation

- Arrivée : après `router.replace('/login')` déclenché par l'écran de chargement — le splash n'est plus dans la pile, retour arrière impossible vers lui.
- Le lien bascule le mode en place (aucun changement de route).
