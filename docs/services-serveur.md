# Services — client serveur, cache collection, vérification

Client HTTP du serveur pyCodebara2 et cache local. Le **contrat serveur
complet** est dans `integration-client.md` **à la racine du projet** (§ référencés ci-dessous) — gros fichier, ne l'y déplace pas.

## `src/services/api.ts` — client HTTP

- Auth login/pass (`GET /user/auth` — §5.2a), auth par tokens (§5.2b), `POST /user` (création — §5.1), `POST /user/renew-password` (§5.9), `PUT /user` (maj profil mairie — §5.10).
- Cartes : `POST /card` (génération depuis un code-barres — §5.3, timeout dédié **150 s**, réponse synchrone `card` ou asynchrone `cardid` seul), `GET /card` (liste — §5.4, sans noms ni saisons), `GET /card/{id}` (une carte + son fichier — §5.5), **`GET /card/check` (§5.6 — anti-tamper : `cid` + `hash` sha256 du .cdz complet dans le header `datas`, réponse `isChecksumGood`)**, `PUT /card/name` (renommage — §5.7, réponse `{cid, card}` sans checksum global).
- Appels protégés **sérialisés** (§9.1), **rotation** du `API_REQUEST_TOKEN` sur tout succès (§3.3), **mort de session** (« Invalid REQUEST TOKEN ») ET **sortie volontaire** (`quitterSession`, déconnexion mairie) = reset tranche + purge + fenêtre connexion (`remplacer`, navigateur).
- Timeout 10 s (hors génération, §2), base URL `EXPO_PUBLIC_SERVER_URL` (`.env`).

## `src/services/collection.ts` — cache collection local (§6.6)

Archives `.cdz` + index { nom, saisonId?, saison? } (nom + saison lues dans datas.json — la maison en dérive sa **liste locale des saisons**), dans un répertoire par id utilisateur :

- natif : `expo-file-system` API nouvelle (`Paths.document/<idUser>/<carteId>.cdz`, sandbox privé : accessible uniquement par l'application) ;
- web : **IndexedDB** custom (base `codebara-cdz`, expo-file-system est natif-only).

Méthodes : `lireIndex` / `majIndex` (nom + saison facultative) / `enregistrerCarte` / `lireCarteLocale` / `supprimerCarte` (destruction d'une archive au hash non conforme, cf. verification.ts).

## `src/services/verification.ts` — vérification + remplissage du stockage local

Exigence produit **2026-11-17** (remplace la comparaison offline `cardHash` du
2026-11-12), exécutée par le splash après authentification — le stockage local
des `.cdz` est déjà **hors d'atteinte de l'utilisateur** (sandbox app, cf.
collection.ts) :

1. `GET /card` (§5.4) → liste des cartes de l'utilisateur ;
2. chaque carte **présente** localement : `sha256(archive complet)` vérifié
   contre le serveur via **`GET /card/check`** (§5.6) — bon : conservée ;
   **écart : archive supprimée du stockage, utilisateur averti (modal finale
   du splash), parcours poursuivi sans pause** ;
3. chaque carte **absente** : `GET /card/{id}` (§5.5), **stockage immédiat**,
   validation interne §6.3 avant stockage, puis vérification du checksum du
   fichier stocké via **`/card/check`** — écart : suppression + avertissement.

Les erreurs d'appel (réseau/session) interrompent le splash (Réessayer) — on ne
détruit jamais sur un doute. Progression poussée à l'appelant ; liste des
corrompues remontée une fois en fin de course (`surCorrompues`).
