# Connexion / Création de compte

Route : `/login` — fichier `src/app/login.tsx`

## Rôle

Fenêtre **double** : sert à la fois de page de connexion et de page de création de compte. La bascule est faite par un lien cliquable en bas — un seul écran, deux modes. **Branche sur le serveur pyCodebara2** (contrat : `/home/champix/projets/pyCodebara2/docs/integration-client.md`).

## Structure visuelle

- Fond blanc, contenu centré dans un `ScrollView` (clavier géré par `KeyboardAvoidingView` padding sur iOS).
- En haut de l'écran : l'œuf (`assets/icon.png`, 130 px).
- Titre « Bienvenue sur codEbara » + sous-titre selon le mode (« Connecte-toi à ton compte » / « Crée ton compte — le mot de passe t'arrivera par e-mail »).
- Champ « Email » (`keyboardType="email-address"`, `autoCapitalize="none"`, `autoCorrect={false}`) ; en mode connexion uniquement, champ « Mot de passe » (`secureTextEntry`).
- Bouton principal vert (#43a047) — libellé selon le mode : « Connexion » ou « Créer mon compte » (désactivé vert pâle #a5d6a7 si champs manquants, e-mail sans `@`, ou requête en cours).
- Bouton debug secondaire **uniquement si `DEBUG=true`** : contour gris, libellé « Debug : passer l'authentification ».
- Message d'état sous le bouton : vert (succès création) / rouge (« Connexion refusée : mail ou mot de passe inconnu », « Ce mail est déjà utilisé », « Serveur injoignable (…URL… ) »).
- Lien souligné vert (#2e7d32) : `Pas encore de compte ? Créer un compte` ↔ `Déjà un compte ? Se connecter`.

## États

- `mode` `'login' | 'signup'`, `identifiant`, `motDePasse`, `message`, `enCours`.
- **Mode connexion** → `authentifierParLogin(mail, mdp)` (`src/services/api.ts`) : `GET /user/auth` avec header `datas: {mail, password}` — `password = SHA256(UTF-8(mail exact + mdp clair))` hex minuscule (contrat §3.2, `src/utils/hash.ts`). Succès : **données serveur + les deux tokens ré-émis** → `dispatch(seConnecter(...))` — `idUser` (`id`), `nickname`, `mail`, `amount`, `hash` (champ interne serveur, conservé), `apiToken`, `requestToken` — puis `router.replace('/principal')`. Tranche **persistée** → reprise de session au prochain lancement.
- **Mode création** → `creerCompte(mail)` : `POST /user {"mail": …}` sans header `datas` (§5.1). Succès : message « Compte créé… » — le serveur génère le mot de passe et l'envoie par e-mail (dépend de sa config ; en `DEBUG=True` rien n'est envoyé, §12.1) — retour au mode connexion. Mail déjà utilisé = HTTP 500 `{"message": null}` → « Ce mail est déjà utilisé ».
- Erreur « Invalid REQUEST TOKEN » impossible sur cette route (§5.2) — pas de gestion implicite ici.
- **Bouton debug** (Notes) : `dispatch(seConnecter(UTILISATEUR_DEBUG))` — id `-9999`, nickname `GOD`, hash `null`, **tokens `null` (pas de session)** — puis `/principal` sans vérification.

## Navigation

- Arrivée : après `router.replace('/login')` déclenché par l'écran de chargement — le splash n'est plus dans la pile, retour arrière impossible vers lui.
- Le lien bascule le mode en place (aucun changement de route).
- Connexion réussie : `router.replace('/principal')` — sortie de pile.
- Bouton debug : `router.replace('/principal')` — même sortie de pile.
- Aucune barre de navigation sur cette fenêtre (`headerShown: false` via `Stack.Screen`).

## Notes

- Les libellés/durées/tokens du serveur : http://<ip>:8080 — adresse via **`EXPO_PUBLIC_SERVER_URL`** (défaut `http://localhost:8080` ; `10.0.2.2` depuis un émulateur Android ; IP LAN d'un téléphone ; CORS du serveur sur le web : `localhost:8081`/`5173`).
- Le mot de passe jamais stocké en clair ni persisté (tranche = hash serveur opaque + tokens).
- Les mêmes règles `DEBUG` qu'avant : `.env` versionné + `app.config.ts` (canaux `EXPO_PUBLIC_DEBUG` + `extra.debug`), redémarrer Metro après changement.
