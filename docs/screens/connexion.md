# Connexion / Création de compte / Mot de passe oublié

Route : `/login` — fichier `src/app/login.tsx`

## Rôle

Fenêtre **triple** : connexion, création de compte et **renouvellement du mot de passe** (lien « Mot de passe oublié ? »). Le mail saisi est conservé d'un mode à l'autre. Branchée sur le serveur pyCodebara2 (contrat : `integration-client.md` à la racine du dépôt).

## Structure visuelle

- Fond blanc, contenu centré dans un `ScrollView` (clavier géré par `KeyboardAvoidingView` padding sur iOS).
- En haut de l'écran : l'œuf (`assets/icon.png`, 130 px).
- Titre « Bienvenue sur codEbara » + sous-titre selon le mode (« Connecte-toi à ton compte » / « Crée ton compte — le mot de passe t'arrivera par e-mail » / « Saisis ton e-mail pour en recevoir un nouveau »).
- Champ « Email » (`keyboardType="email-address"`, `autoCapitalize="none"`, `autoCorrect={false}`) ; en mode connexion uniquement, champ « Mot de passe » (`secureTextEntry`).
- Bouton principal vert (#43a047) — libellé selon le mode : « Connexion » / « Créer mon compte » / « Recevoir un nouveau mot de passe » (désactivé vert pâle #a5d6a7 si champs manquants, e-mail sans `@`, ou requête en cours).
- Bouton debug secondaire **uniquement si `DEBUG=true`** : contour gris, libellé « Debug : passer l'authentification ».
- Message d'état sous le bouton : vert (succès création / mot de passe renouvelé) / rouge (« Connexion refusée : mail ou mot de passe inconnu », « Création refusée : vérifie cette adresse (elle est peut-être déjà utilisée) », « Serveur injoignable (…) »).
- Liens soulignés verts :
  - « Mot de passe oublié ? » (masquer en mode oublié) → mode renouvellement ;
  - bascule : `Pas encore de compte ? Créer un compte` ↔ `Déjà un compte ? Se connecter` ↔ (mode oublié) `Je l'ai retrouvé — me connecter`.

## États

- `mode` `'login' | 'signup' | 'oublie'`, `identifiant` (partagé entre les modes), `motDePasse`, `message`, `enCours`.
- **Mode connexion** → `authentifierParLogin(mail, mdp)` (`src/services/api.ts`) : `GET /user/auth` avec header `datas: {mail, password}` — `password = SHA256(UTF-8(mail exact + mdp clair))` hex minuscule (contrat §3.2, `src/utils/hash.ts`). Succès : **données serveur + les deux tokens ré-émis** → `dispatch(seConnecter(...))` — `idUser` (`id`), `nickname`, `mail`, `amount`, `hash` (champ interne serveur, conservé), `apiToken`, `requestToken` — puis `router.replace('/principal')`. Tranche **persistée** → reprise de session au prochain lancement.
- **Mode création** → `creerCompte(mail)` : `POST /user {"mail": …}` sans header `datas` (§5.1). Succès : message « Compte créé… » — le serveur génère le mot de passe et l'envoie par e-mail (dépend de sa config ; en `DEBUG=True` rien n'est envoyé, §12.1) — retour au mode connexion. Refus métier = **403 `Forbidden`** (mail mal formé OU compte déjà existant, cas volontairement confondus — contrat §4/dis 2026-10-30) → « Création refusée : vérifie cette adresse… ».
- **Mode oublié** → `renouvelerMotDePasse(mail)` : `POST /user/renew-password {"mail"}` (§5.9, sans tokens). Succès `{"renewed": true}` **sans token** — aucune rotation. Échec = **403 `Forbidden`** ambigu (mail mal formé OU compte inconnu — **pas d'oracle d'existence de compte**) → l'écran affiche le même message ambigu que le succès : « Si ce compte existe, un courriel avec le nouveau mot de passe vient de partir. » Le serveur écrit le nouveau mot de passe (SHA2(mail+clair)) et l'envoie par e-mail ; avec le serveur en `DEBUG=True`, l'e-mail n'est pas envoyé (mot de passe imprimé dans le log du serveur). Retour au mode connexion après soumission.
- Erreur « Invalid REQUEST TOKEN » impossible sur ces routes (§5.2/§5.9) — pas de gestion implicite ici.
- **Bouton debug** (Notes) : `dispatch(seConnecter(UTILISATEUR_DEBUG))` — id `-9999`, nickname `GOD`, hash `null`, **tokens `null` (pas de session)** — puis `/principal` sans vérification.

## Navigation

- Arrivée : après `router.replace('/login')` déclenché par l'écran de chargement — le splash n'est plus dans la pile, retour arrière impossible vers lui.
- Le lien bascule le mode en place (aucun changement de route) ; le mail saisi est conservé.
- Connexion réussie : `router.replace('/principal')` — sortie de pile.
- Bouton debug : `router.replace('/principal')` — même sortie de pile.
- Aucune barre de navigation sur cette fenêtre (`headerShown: false` via `Stack.Screen`).

## Notes

- Les libellés/durées/tokens du serveur : http://<ip>:8080 — adresse via **`EXPO_PUBLIC_SERVER_URL`** (défaut `http://localhost:8080` ; `10.0.2.2` depuis un émulateur Android ; IP LAN d'un téléphone ; CORS du serveur sur le web : `localhost:8081`/`5173`).
- Le mot de passe jamais stocké en clair ni persisté (tranche = hash serveur opaque + tokens).
- Les mêmes règles `DEBUG` qu'avant : `.env` versionné + `app.config.ts` (canaux `EXPO_PUBLIC_DEBUG` + `extra.debug`), redémarrer Metro après changement.
