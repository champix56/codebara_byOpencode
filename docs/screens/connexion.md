# Connexion / Création de compte / Mot de passe oublié

Fenêtre : `connexion` — fichier `src/ecrans/connexion.tsx`

## Rôle

Fenêtre **triple** : connexion, création de compte et **renouvellement du mot de passe** (lien « Mot de passe oublié ? »). Le mail saisi est conservé d'un mode à l'autre. Branchée sur le serveur pyCodebara2 (contrat : `integration-client.md` à la racine du dépôt).

## Structure visuelle

- Fond blanc, contenu centré dans un `ScrollView` (clavier géré par `KeyboardAvoidingView` padding sur iOS).
- En haut de l'écran : l'œuf (`assets/icon.png`, 130 px).
- Titre « Bienvenue sur codEbara » + sous-titre selon le mode (« Connecte-toi à ton compte » / « Crée ton compte — le mot de passe t'arrivera par e-mail » / « Saisis ton e-mail pour en recevoir un nouveau »).
- Sur mobile comme sur web : champ « Adresse du serveur » (`keyboardType="url"`, `autoCapitalize="none"`, `autoCorrect={false}`), **prérempli avec la valeur de `EXPO_PUBLIC_SERVER_URL` (.env)** et éditable avant la connexion. Le champ est **masqué par défaut** ; il réapparaît après **5 appuis rapides sur le logo** (usage développeur, y compris sur web). La valeur saisie est appliquée (`definirUrlBase`) avant tout appel API, et tous les appels suivants s'appuient dessus. Sur web, `.env` fournit la valeur initiale (inlinée à la compilation) ; la saisie ne vaut que pour la session en cours et l'URL du navigateur reste figée à la racine.
- Bouton principal vert (#43a047) — libellé selon le mode : « Connexion » / « Créer mon compte » / « Recevoir un nouveau mot de passe » (désactivé vert pâle #a5d6a7 si champs manquants, e-mail sans `@`, ou requête en cours).
- Bouton debug secondaire **uniquement si `DEBUG=true`** : contour gris, libellé « Debug : passer l'authentification ».
- Message d'état sous le bouton : vert (succès création / mot de passe renouvelé) / rouge (« Connexion refusée : mail ou mot de passe inconnu », « Création refusée : vérifie cette adresse (elle est peut-être déjà utilisée) », « Serveur injoignable (…) »).
- Liens soulignés verts :
  - « Mot de passe oublié ? » (masquer en mode oublié) → mode renouvellement ;
  - bascule : `Pas encore de compte ? Créer un compte` ↔ `Déjà un compte ? Se connecter` ↔ (mode oublié) `Je l'ai retrouvé — me connecter`.
- En bas du contenu, le champ de version « CodEbara v0.0.x » (`VERSION_APPLI`, généré depuis `NOTES-VERSION.md`) — vert, pressable, ouvre la fenêtre notes de version (même rendu que dans la principale, v0.0.17).

## États

- `mode` `'login' | 'signup' | 'oublie'`, `identifiant` (partagé entre les modes), `motDePasse`, `message`, `enCours`, `adresseServeur` (adresse de base du serveur, préremplie avec `.env`), `afficherUrl` + compteur/minuteur des 5 appuis sur le logo.
- **Mode connexion** → `authentifierParLogin(mail, mdp)` (`src/services/api.ts`) : `GET /user/auth` avec header `datas: {mail, password}` — `password = SHA256(UTF-8(mail exact + mdp clair))` hex minuscule (contrat §3.2, `src/utils/hash.ts`). Succès : **données serveur + les deux tokens ré-émis** → `dispatch(seConnecter(...))` — `idUser` (`id`), `nickname`, `mail`, `amount`, `hash` (champ interne serveur, conservé), `apiToken`, `requestToken` — puis **le splash est remis** : `remplacer({ nom: 'chargement', mode: 'post-connexion' })` (décision produit 2026-11-12) — le splash enchaîne « connexion » puis « récupération des cartes » (vérification du cache local + téléchargement des manquantes, cf. chargement.md / verification.ts) avant d'ouvrir le principal. Tranche **persistée** → reprise de session au prochain lancement.
- **Mode création** → `creerCompte(mail)` : `POST /user {"mail": …}` sans header `datas` (§5.1). Succès : message « Compte créé… » — le serveur génère le mot de passe et l'envoie par e-mail (dépend de sa config ; en `DEBUG=True` rien n'est envoyé, §12.1) — retour au mode connexion. Refus métier = **403 `Forbidden`** (mail mal formé OU compte déjà existant, cas volontairement confondus — contrat §4/dis 2026-10-30) → « Création refusée : vérifie cette adresse… ».
- **Mode oublié** → `renouvelerMotDePasse(mail)` : `POST /user/renew-password {"mail"}` (§5.9, sans tokens). Succès `{"renewed": true}` **sans token** — aucune rotation. Échec = **403 `Forbidden`** ambigu (mail mal formé OU compte inconnu — **pas d'oracle d'existence de compte**) → l'écran affiche le même message ambigu que le succès : « Si ce compte existe, un courriel avec le nouveau mot de passe vient de partir. » Le serveur écrit le nouveau mot de passe (SHA2(mail+clair)) et l'envoie par e-mail ; avec le serveur en `DEBUG=True`, l'e-mail n'est pas envoyé (mot de passe imprimé dans le log du serveur). Retour au mode connexion après soumission.
- Erreur « Invalid REQUEST TOKEN » impossible sur ces routes (§5.2/§5.9) — pas de gestion implicite ici.
- **Bouton debug** (Notes) : `dispatch(seConnecter(UTILISATEUR_DEBUG))` — id `-9999`, nickname `GOD`, hash `null`, **tokens `null` (pas de session)** — puis splash en mode `debug` (v0.0.16) : ni authentification ni récupération de cartes, mais l'étape saison reste obligatoire (attente du serveur sur web) avant le principal.

## Navigation

- Arrivée : après `remplacer({ nom: 'connexion' })` déclenché par l'écran de chargement — le splash n'est plus dans la pile, retour arrière impossible vers lui.
- Le lien bascule le mode en place (aucun changement de fenêtre) ; le mail saisi est conservé.
- Connexion réussie : `remplacer({ nom: 'chargement', mode: 'post-connexion' })` — sortie de pile (le splash relancé mène ensuite au principal).
- Bouton debug : `remplacer({ nom: 'chargement', mode: 'debug' })` — sortie de pile vers le splash allégé, qui garde l'étape saison (surtout sur web).
- Champ version : `naviguer({ nom: 'notes' })` — ouvrable depuis la connexion, comme depuis la principale ; retour à la connexion par le retour standard de l'en-tête partagé.
- Aucune barre d'en-tête sur cette fenêtre (plein écran).

## Notes

- Les libellés/durées/tokens du serveur : http://<ip>:8080 — adresse via **`EXPO_PUBLIC_SERVER_URL`** (défaut `http://localhost:8080` ; `10.0.2.2` depuis un émulateur Android ; IP LAN d'un téléphone ; CORS du serveur sur le web : `localhost:8081`/`5173`).
- Sur web, pointer l'adresse saisie vers une autre origine ne suffit pas : le serveur doit autoriser l'**origine de la page** dans son CORS (cf. §2 du contrat), sinon le navigateur bloque l'appel avant même qu'il atteigne le serveur.
- Le mot de passe jamais stocké en clair ni persisté (tranche = hash serveur opaque + tokens).
- Les mêmes règles `DEBUG` qu'avant : `.env` versionné + `app.config.ts` (canaux `EXPO_PUBLIC_DEBUG` + `extra.debug`), redémarrer Metro après changement.
