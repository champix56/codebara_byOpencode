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
- Sous le bouton principal, **uniquement si `EXPO_PUBLIC_DEBUG=true`** (voir Notes) : bouton debug secondaire — contour gris (#d1d5db), texte gris (#6b7280), libellé « Debug : passer l'authentification ».
- Lien souligné vert (#2e7d32) sous le bouton : `Pas encore de compte ? Créer un compte` ↔ `Déjà un compte ? Se connecter`.

## États

- `mode` : `'login' | 'signup'` — conditionne libellés du bouton, sous-titre et lien.
- `identifiant`, `motDePasse` : valeurs des champs.
- Bouton désactivé (vert pâle #a5d6a7) tant que l'un des champs est vide (`canSubmit`).
- `soumettre()` : **TODO** — à brancher sur l'authentification réelle (mode login → connexion, signup → création). En attendant le serveur, il ouvre `/principal` sans vérification.
- `MODE_DEBUG` : variable d'environnement `DEBUG` aiguillée par `app.config.ts` — canal inliné `process.env.EXPO_PUBLIC_DEBUG === 'true'` (primaire) + `Constants.expoConfig?.extra?.debug === true` (redondance natif). `passerAuthentification()` **charge le compte debug dans la tranche utilisateur du store Redux** (`seConnecter(UTILISATEUR_DEBUG)` : id `-9999`, nickname `GOD`, hash `null`, token `-1`, mail `codebara@free.fr` — tranche persistée cf. `src/store/utilisateur.ts`) puis ouvre `/principal` (aucun champ requis).

## Navigation

- Arrivée : après `router.replace('/login')` déclenché par l'écran de chargement — le splash n'est plus dans la pile, retour arrière impossible vers lui.
- Le lien bascule le mode en place (aucun changement de route).
- « Connexion » / « Créer mon compte » : `router.replace('/principal')` (transitoire, ci-dessus) — la fenêtre de connexion sort de la pile, retour arrière impossible vers elle.
- Bouton debug : `router.replace('/principal')` — même sortie de pile.
- Aucune barre de navigation sur cette fenêtre (`headerShown: false` via `Stack.Screen`).

## Notes

- Le bouton debug dépend de la variable d'environnement **`DEBUG`** (« bare », sans préfixe). Sources équivalentes (priorité : 1 > 2 > 3) :
  1. shell : `DEBUG=true npx expo start` ;
  2. **.env** versionné (`DEBUG=true` — valeur actuelle du dépôt) ;
  3. `.env.local` non versionné, pour la surcharge locale.
- La config dynamique [`app.config.ts`](../../app.config.ts) lit `process.env.DEBUG` puis fait **l'aiguillage vers deux canaux** :
  - `process.env.EXPO_PUBLIC_DEBUG` = `'true'|'false'` — inlinée dans chaque bundle JS (web dev, web export, natif). C'est le canal utilisé en première position dans l'app ;
  - `extra.debug` dans la config — lu via `Constants.expoConfig.extra.debug` en redondance (fiable en natif : le manifeste porte la valeur).
- Pourquoi la redondance : sur **web en dev**, `expo-constants` suppose que `process.env.APP_MANIFEST` a été inliné (`ExponentConstants.web.js`), or le bundle `expo start` web ne l'embarque pas → `Constants.expoConfig` n'y porte pas `extra` de façon fiable. Le canal inliné `EXPO_PUBLIC_DEBUG` contourne ce cas.
- Après changement de `DEBUG` : **redémarrer** `npx expo start` (la config dynamique est évaluée au démarrage de Metro). Vérification : `npx expo config --type public | grep debug`.
- Attention : `.env` est inclus dans les builds — repasser en `DEBUG=false` (ou `DEBUG=false` en shell) avant un export/binaire de production.
