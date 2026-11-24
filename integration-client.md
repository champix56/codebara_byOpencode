# Contrat d'interface Codebara — intégration du client (app mobile / web)

> Document **autoportant** destiné au développement du client Codebara (application
> Android `codEBara.apk` et éventuel front web). Copiez-le dans le dépôt du client :
> il ne dépend d'aucun autre fichier serveur.
>
> Version du contrat établie à partir du **code serveur réel** (pyCodebara2, oct. 2026)
> et de la spéc. d'origine `endpoints.odt`. Toute évolution de contrat est notée
> côté serveur dans `docs/api.md`. Le projet est **en développement** : les endpoints
> signalés « ✗ » ne sont pas encore disponibles.

---

## 1. Objet

Permettre au client de :

1. créer un compte et s'authentifier (double token rotatif) ;
2. scanner un code-barres et **générer une carte** (`POST /card`) ;
3. **récupérer, stocker et afficher** les cartes (archive `.cdz`) ;
4. contrôler leur intégrité (checksums SHA-256) et les **renommer** ;
5. charger l'écran « app season » (layout de l'application).

---

## 2. Connectivité

| Élément | Valeur |
|---|---|
| Protocole | **HTTP brut** (pas de HTTPS sur le serveur pour l'instant — voir §12) |
| Hôte:port | `http://<ip-serveur>:8080` (défaut serveur : `0.0.0.0:8080`) |
| Démarrage serveur | lancé **depuis la racine du dépôt** (`python main.py`) ; il lit `./html/`, `./seasons/` en chemins relatifs |
| Émulateur Android | `http://10.0.2.2:8080` (10.0.2.2 = loopback de l'hôte) |
| Poste physique sur le LAN | `http://<ip-LAN-du-PC>:8080` (mêmes sous-réseau / pare-feu ouvert) |
| CORS (front web uniquement) | origines autorisées : `http://localhost:8081` et `http://localhost:5173` — toute autre origine web sera **bloquée par le navigateur** ; une app native Android n'est pas concernée |
| Headers HTTP personnalisés | autorisés côté CORS : `email`, `token`, **`datas`** |
| Taille maximale d'un body | **1 Mo** (le client n'envoie que de petits JSON — jamais atteint) |
| Timeout recommandé client | 5–10 s pour les appels simples ; **60–120 s minimum pour `POST /card`** (génération d'image IA, actuellement synchrone) |
| Content-Type des body | `application/json` (texte JSON brut, non encodé URL) |

Fichiers statiques servis sans authentification (source : `handle_image`, tout `./html<path>`) :
`GET /` (page d'accueil), `GET /favicon.ico`, `GET /<chemin>.png`
(`barcode.png`, `egg.png`, `front.png`…), `GET /<chemin>.apk` (dernière version de
l'app.). ⚠ **Seul `./html/` est servi** : les images de saison sous `./seasons/` ne le
sont pas (cf. §5.8). `OPTIONS *` renvoie 200 (pré-vol CORS).

---

## 3. Modèle d'authentification (double token rotatif)

Compte = e-mail (`mail`) + mot de passe. Le serveur délivre **deux tokens** :

| Token | Vie | Rôle |
|---|---|---|
| `API_TOKEN` | long (ré-émis uniquement à la nouvelle authentification login/pass) | identifiant d'application |
| `API_REQUEST_TOKEN` | **une requête** (consommé à chaque appel réussi, jamais rejouable) | preuve de session courante |

### 3.1 Obtenir les tokens

- **Créer un compte** : `POST /user`, body `{"mail": "<email>"}` *(sans header `datas`, voir §5.1)*
  → réponse `{"API_TOKEN": "<hex 64>", "API_REQUEST_TOKEN": "<hex 64>"}`.
  ⚠ Le serveur génère un mot de passe aléatoire et l'envoie **par e-mail** au joueur
  (décision 2026-10-30 : envoi systématique, **même en `DEBUG=True`**) ; aucun mot de
  passe n'est jamais transmis au client via l'API — voir §12.1.
- **Authentification login/pass** : `GET /user/auth` avec header `datas`
  (voir §5.2) → renvoie les données utilisateur **+ les deux tokens fraîchement ré-émis**.

### 3.2 Calcul du mot de passe côté client (critique)

Chaîne réelle (vérifiée dans le code) :

- **À la création** : le serveur stocke en base `SHA2(mail + motDePasseClair, 256)`
  (`INSERT ... SHA2(...)`, `codebara/users/userMysql.py`).
- **À l'authentification** : le serveur compare **directement** le champ `password`
  stocké à la valeur reçue (`WHERE mail=... AND password=<valeur reçue>`) — il ne
  re-hache **pas** une seconde fois.

Le client doit donc envoyer dans `datas.password` exactement :

```
password = SHA256( UTF-8(mail_exact) + UTF-8(motDePasseClair) )  →  hexadécimal minuscule (64 car.)
```

- `mail_exact` = la **chaîne exacte** utilisée à la création du compte (casse comprise) :
  la comparaison du serveur sur `mail` est « ai_ci » (insensible à la casse), mais (le hash
  stocké).change si la casse change — si le hash est calculé avec une casse différente,
  l'authentification échoue sans message dédié (404 générique, cf. §5.2).
- encodage : UTF-8, hexdigest en minuscules (comme MySQL `SHA2`, ex. Python
  `hashlib.sha256(s.encode()).hexdigest()`).

Pseudo-code :

```text
function hashPassword(mail: string, clear: string): string
    return sha256Hex(mail + clear)          // concaténation, sans séparateur
```

### 3.3 Rotation des tokens (à intégrer absolument)

| Appel | Ce que renvoie le serveur | Action client |
|---|---|---|
| login/pass réussi (`GET /user/auth` avec `mail`+`password`) | les **deux** tokens remplacés + données user | stocker **les deux** |
| `POST /user` (création) | les deux tokens (première émission) | stocker **les deux** |
| toute route protégée réussie (`/card/*`, `/season`, `/users`, `/friends`, `/friend/*`) | un **nouveau** `API_REQUEST_TOKEN` **dans le corps JSON** de la réponse (champ `API_REQUEST_TOKEN`) | **remplacer** le `API_REQUEST_TOKEN` stocké ; conserver `API_TOKEN` |
| erreur applicative (corps `{"message": …}` 400/404) | **pas de données ni de token**, donc pas de renouvellement | **conserver** le dernier token valide (la rotation n'a lieu que si la route se termine en succès complet ; ne pas s'attendre à un token dans une réponse d'erreur) |
| **exception `/friend/*`** : erreur métier 400/404 (demande déjà existante, amitié déjà validée, « Friend not found »…) | le couple de tokens est **consommé quand même**, et un **nouveau `API_REQUEST_TOKEN` est renvoyé dans le corps d'erreur** (ajout 2026-11-19, cf. §5.13/§5.14) | **stocker le token roté depuis le corps d'erreur avant de relancer l'erreur** — sinon l'appel suivant consommerait un couple déjà utilisé et déconnecterait l'utilisateur |
| erreur token invalide (routes `/card`, message 400 « Invalid REQUEST TOKEN ») | corps `{"message": "Invalid REQUEST TOKEN"}` | session perdue → déclencher la re-connexion login/pass (sur `/user/auth` l'échec est un 404, cf. §5.2) |

Règle d'or : **le `API_REQUEST_TOKEN` utilisable est toujours celui renvoyé par le dernier
appel protégé réussi**. Un token périmé ne sert plus jamais. Seule la famille
`/friend/*` déroge à la règle « pas de token sur erreur » : son token de
rotation est valide même dans un corps d'erreur.

Stockage : `EncryptedSharedPreferences`/Keystore sur Android, stockage chiffré côté web.
Ne jamais journaliser les tokens.

### 3.5 Mécanique d'émission côté serveur (référence exacte, `codebara/users/userMysql.py`)

| Moment | Qu'est-ce qui change |
|---|---|
| Création du compte | `API_token = SHA256(mail + 64 caractères aléatoires + password_clair)` ; `API_request_token = SHA256(password_clair + 64 caractères aléatoires)` |
| Re-connexion login/pass | les **deux** colonnes remplacées par `SHA256(64 caractères aléatoires)` (`resetTokens`, type `API_BOTH`) |
| Chaque appel protégé réussi | seule la colonne `API_request_token` est remplacée (`renewToken` → `API_REQUEST_TOKEN`) |
| Validation d'un appel protégé | un seul `SELECT ... WHERE API_token='…' AND API_request_token='…'` : le **couple** doit matcher exactement la paire courante en base |

Conséquences (à garder en tête) :

- il n'y a **aucune expiration horaire** côté serveur ni journal de sessions : un couple
  de tokens n'est « périmé » que **remplacé** ;
- un appel **parallèle** ou dupliqué avec le même couple échoue (ou peut échouer si le
  premier appel a déjà fait tourner) — sérialisez les appels (cf. §9.1) ;
- une re-connexion login/pass **détruit toute autre session** de ce compte (le
  `API_TOKEN` change partout) ;
- aucun « logout » n'existe côté serveur : la seule invalidation est la rotation.

### 3.4 Header `datas`

Toutes les routes sauf `POST /user`, statiques et `GET /` exigent un en-tête HTTP nommé
exactement **`datas`** contenant du **JSON brut** :

```
datas: {"API_TOKEN": "ab12...", "API_REQUEST_TOKEN": "cd34..."}
```

Écrire le JSON sur une seule ligne, sans saut de ligne (les valeurs sont hex
→ ASCII sûr). Rien d'autre (pas d'encodage base64, pas de préfixe `Bearer`).

---

## 4. Modèle de réponses et d'erreurs

- **Réponse de succès** : `HTTP 200` avec **corps JSON** — le code métier (ex. 201
  Created) est dans l'objet métier d'origine, **pas** dans l'en-tête HTTP (le corps est
  envoyé par `web.json_response` sans statut dédié). Ne vous fiez qu'au contenu JSON +
  à la présence d'`API_REQUEST_TOKEN`.
- **Réponse d'erreur** : `HTTP 400`, `403` ou `404` avec un corps **texte au format JSON
  minimal**, un seul objet `{"message": "..."}` (vérifié dans `networkResponses.toResponse`) :

  `{"message": "Invalid REQUEST TOKEN"}`

  (Un seul objet `{"message": "..."}` ; pas de données, pas de token.) Messages exacts :

  | Message | Cause | Réaction client |
  |---|---|---|
  | `Forbidden` (403) | « métier refusé » : `POST /user` (mail mal formé ou compte déjà existant), `POST /user/renew-password` (mail mal formé ou compte inconnu) | formulaire : ressaissir le mail ; sur l'inscription, proposer connexion / mot de passe oublié |
  | `Invalid REQUEST TOKEN` (400) | `API_TOKEN`/`API_REQUEST_TOKEN` périmés ou faux | re-connexion (login/pass) puis refaire l'appel |
  | `Invalid Path/Method for: method: X on route: /...` (404) | endpoint inexistant, méthode non prévue — **ou échec d'authentification sur `/user/auth`** (login/pass ou tokens invalides) | ne pas insister ; sur `/user/auth` cela signifie « identifiants refusés » |
  | `Invalid Request with body given for: ...` (400) | JSON malformé / clé manquante / exception serveur — **masque aussi les pannes internes** (dont l'indisponibilité du serveur d'IA, cf. §9.2) | log complet ; sur `POST /card`, signaler « génération indisponible » |
  | `Invalid Response issue with body given for: ...` (404) | erreur non prévue côté serveur | signaler et retenter plus tard |
- CORS : sur web, un fetch cross-origin vers une origine non autorisée est **bloqué par
  le navigateur** — respectez §2.
- **Limites actuelles du modèle** : pas de distinction statut HTTP / statut métier (tout
  succès = 200 JSON), et un corps d'erreur réduit au message. Reconnaissez les erreurs
  par sous-chaîne (`Invalid REQUEST TOKEN`), jamais en comparant la phrase entière.

---

## 5. Endpoints (état réel, oct. 2026)

### 5.0 Récapitulatif

| Endpoint | Méthode | Auth | État |
|---|---|---|---|
| `/user/auth` | GET | non (c'est l'appel d'auth) | **✔ actif** |
| `/user` | POST | non (création) | **✔ actif** (403 Forbidden si mail mal formé ou compte déjà existant) |
| `/user/renew-password` | POST | non (mot de passe oublié) | **✔ actif** (ajouté 2026-10-30, cf. §5.9) |
| `/user` | PUT (maj profil « mairie ») | tokens | **✔ actif** (ajouté 2026-10-30, cf. §5.10) |
| `/user` | GET (user connecté) | tokens | ✗ prévu (404) |
| `/user/{id}` | GET | tokens | ✗ prévu (404) |
| `/user` | PUT (maj profil) | tokens | ✗ prévu (404) |
| `/card` | POST (générer) | tokens | **✔ actif** |
| `/card` | GET (liste) | tokens | **✔ actif** |
| `/card/{id}` | GET (une carte) | tokens | **✔ actif** |
| `/card/check` | GET (checksum) | tokens | **✔ actif** |
| `/card/name` | PUT (renommer) | tokens | **✔ actif** |
| `/season` | GET (saison d'affichage courante, `.cds` base64) | tokens | **✔ actif** (implémenté 2026-11-17, branche `opencode` du serveur, cf. §5.11) |
| `/season/check` | GET (hash de la saison courante) | tokens | **✔ actif** (implémenté 2026-11-17, branche `opencode`, cf. §5.11) |
| `/users?value=…` | GET (recherche de joueurs par début de nickname/mail) | tokens | **✔ actif** (serveur 2026-11-18, **intégré au client dans la fenêtre « école »**, cf. §5.12) |
| `/friend/request/{id}` | POST (demande / acceptation par POST inverse) | tokens | **✔ actif** (serveur 2026-11-19, intégré au client, cf. §5.13) |
| `/friend/request/{id}` | DELETE (refus d'une demande reçue) | tokens | **✔ actif** (serveur 2026-11-19, intégré au client, cf. §5.13) |
| `/friend/requested` | GET (demandes reçues en attente) | tokens | **✔ actif** (serveur 2026-11-19, intégré au client, cf. §5.13) |
| `/friends` | GET (amis validés, sans limite ni pagination) | tokens | **✔ actif** (serveur 2026-11-19, intégré au client, cf. §5.13) |
| `/friend/{id}/cards` | GET (liste des cartes d'un ami, sans archive) | tokens | **✔ actif** (serveur 2026-11-19, intégré au client, cf. §5.14) |
| `/friend/{iduser}/cards/{idcard}` | GET (une carte de la liste, `.cdz` inclus) | tokens | **✔ actif** (serveur 2026-11-19, intégré au client, cf. §5.14) |
| `/`, `/favicon.ico`, `*.png`, `*.apk` | GET | non | ✔ (statiques) |

### 5.1 `POST /user` — création de compte (sans authentification)

**Requête**

```
POST /user HTTP/1.1
Content-Type: application/json

{"mail": "joueur@exemple.fr"}
```

**Réponse (succès)**

```json
{"API_TOKEN": "9a1f…64 hex…", "API_REQUEST_TOKEN": "0e7c…64 hex…"}
```

**Effets serveur** : validation du mail (format + unicité), création de l'utilisateur
(nickname initial = mail), mot de passe généré (15 car.) **envoyé par e-mail** (titre
`CodEbara`, logo œuf inline, identifiants en clair + consigne « changez ce mot de passe
au plus vite depuis la mairie ») — **toujours envoyé, même en `DEBUG=True`** 
(décision 2026-10-30, cf. §12.1) ; retourne les deux tokens.
**Limites** (vérifiées dans le code, état 2026-10-30) :
- le mail doit être de forme `local@domaine.tld` (`isMailValid`) → sinon
  **403 `{"message": "Forbidden"}`** ;
- mail déjà utilisé → **403 `{"message": "Forbidden"}`** (côté client, proposez
  l'écran de connexion ou « mot de passe oublié ») ;
- body manquant ou `mail` absent : 400 `{"message": "Invalid Request with body given
  for: method: POST on route:/user"}` ;
- pas de protection anti-spam.

### 5.2 `GET /user/auth` — authentification

Deux modes mutuellement exclusifs dans le header `datas` :

**(a) Par login/pass**

```
GET /user/auth HTTP/1.1
datas: {"mail": "joueur@exemple.fr", "password": "<sha256Hex(mail+mdp)>"}
```

Réponse (succès) — données user **+ les deux tokens** ré-émis :

```json
{
  "id": 670,
  "nickname": "god",
  "mail": "god",
  "amount": 6666666666,
  "hash": "5723…64 hex…",
  "API_TOKEN": "…nouveau…",
  "API_REQUEST_TOKEN": "…nouveau…"
}
```

**(b) Par tokens (reprise de session au démarrage de l'app)**

```
GET /user/auth HTTP/1.1
datas: {"API_TOKEN": "…", "API_REQUEST_TOKEN": "…"}
```

Réponse (succès) : **seulement les données user** (`id`, `nickname`, `mail`, `amount`,
`hash`) — **pas de renouvellement** dans cette branche.

**Échecs (vérifiés dans `user_route.py`)** :

| Situation | Réponse |
|---|---|
| tokens invalides ou inconnus | `HTTP 404`, corps `{"message": "Invalid Path/Method for: method: GET on route:/user/auth"}` (pas de « Invalid REQUEST TOKEN » sur cette route) |
| `mail`/`password` présents mais pair faux ou inconnu | même `HTTP 404` générique (« authentification échouée » n'a pas de message dédié) |
| header `datas` absent / JSON invalide / clé manquante | `HTTP 400`, corps `{"message": "Invalid Request with body given for: ..."}` |

Dans tous les cas d'échec : considérez la session comme morte et lancez (a).

**Note** : `hash` est un champ interne de la table user (hash de contrôle du profil,
`tmp.sql` : `SHA2(nickname,256)` à la création) — le client n'a pas à le consommer.
`amount` = monnaie (fonctionnalité non utilisée à ce jour).

### 5.3 `POST /card` — générer une carte depuis un code-barres

**Requête**

```
POST /card HTTP/1.1
datas: {"API_TOKEN": "…", "API_REQUEST_TOKEN": "…"}
Content-Type: application/json

{"cb": "64527486384936"}
```

- `cb` = **chiffres du code-barres uniquement** (pas de `-`, pas d'espaces).
  Longueurs acceptées aujourd'hui (testées) : 13 (EAN-13), 12 (UPC-A). Le serveur ne
  vérifie ni la checksum EAN ni le format — mais **le déterminisme du tirage dépend de la
  totalité des chiffres** : toujours envoyer le code complet tel qu'imprimé.
- Depuis le 2026-11-24, la génération est **asynchrone** (pool de threads) : la
  réponse est immédiate avec `{\"cardid\": …}` (id définitif, §5.15). Aucun
  timeout long n'est plus nécessaire.
- Si le serveur d'IA est arrêté (configuration actuelle de dev) : 400
  `{"message": "Invalid Request with body given for: ..."}` — traité comme « service de
  génération indisponible » (§9.2).

**Réponse (succès)**

```json
{"cardid": 857, "API_REQUEST_TOKEN": "…"}
```

`cardid` = identifiant définitif de la carte. Le `.cdz` n'est **pas** joint : la
génération se poursuit côté serveur (§5.15) et le client est averti par une
notification `nouvelles cartes`. Le téléchargement n'a lieu que lors de
l'acceptation explicite via `POST /awaiting_cards/{id}` (nom optionnel) ; côté
client, `fabrication-carte.tsx` se contente donc du `cardid` et n'écrit aucun
fichier. Le client tolère néanmoins une réponse contenant `card`/`checksum`
(ancien mode synchrone `TEST`).

### 5.4 `GET /card` — liste des cartes de l'utilisateur connecté

```
GET /card HTTP/1.1
datas: {"API_TOKEN": "…", "API_REQUEST_TOKEN": "…"}
```

Réponse :

```json
{
  "cards": [
    {"id": 844, "cardHash": "7df7…64 hex…", "cardpower": 100, "health": 76, "attack": 51},
    {"id": 845, "cardHash": "59ee…", "cardpower": 100, "health": 55, "attack": 22}
  ],
  "API_REQUEST_TOKEN": "…nouveau…"
}
```

> Les champs `name`, `specials`, etc. ne sont **pas** dans la liste — le `name` s'obtient
> en chargeant la carte (`GET /card/{id}` → `datas.json` du `.cdz`). Gardez un cache local.

### 5.5 `GET /card/{id}` — une carte (avec son fichier)

```
GET /card/844 HTTP/1.1
datas: {"API_TOKEN": "…", "API_REQUEST_TOKEN": "…"}
```

Réponse :

```json
{
  "id": 844, "cardHash": "…", "cardpower": 100, "health": 76, "attack": 51,
  "fileloc": "./contents/user/670/844.cdz",
  "card": "<base64 du .cdz 844>",
  "API_REQUEST_TOKEN": "…nouveau…"
}
```

- `card` est **toujours** renvoyé : le client n'a jamais d'URL de fichier à deviner ;
  `fileloc` est un chemin interne serveur (non utilisable tel quel).
- Utilisez ce fichier pour : (1) premier téléchargement après un `POST /card` asynchrone,
  (2) re-remplissage du cache local, (3) rafraîchissement après renommage.

### 5.6 `GET /card/check` — vérifier l'intégrité d'une carte contre la base

Le `cid` et le `hash` attendus sont transportés dans le **header `datas`** (pas dans le body) :

```
GET /card/check HTTP/1.1
datas: {"API_TOKEN": "…", "API_REQUEST_TOKEN": "…", "cid": 844, "hash": "<sha256 du .cdz>"}
```

Réponse :

```json
{"isChecksumGood": true, "API_REQUEST_TOKEN": "…nouveau…"}
```

Usage client (moins critique) : comparaison du hash **du fichier complet** que le joueur
possède avec celui enregistré côté serveur (anti-tamper). La vérification locale des
`hashs.json` internes (§6.3) est, elle, gratuite et fonctionne hors ligne.

### 5.7 `PUT /card/name` — renommer une carte

```
PUT /card/name HTTP/1.1
datas: {"API_TOKEN": "…", "API_REQUEST_TOKEN": "…"}
Content-Type: application/json

{"cid": 844, "name": "Éléphant judo"}
```

Réponse : **même forme que l'obtention d'une carte fraîchement mise à jour** :

```json
{"cid": 844, "card": "<base64 du .cdz mis à jour>", "API_REQUEST_TOKEN": "…"}
```

> ⚠ Bug côté serveur connu (repéré oct. 2026) : le renommage ré-empaquette l'archive en
> **tar.xz** alors que la génération produit du **ZIP** — un fichier renommé peut être
> illisible pour un décompresseur ZIP simple (le serveur doit être corrigé : décision
> « ZIP partout », cf. backlog serveur). Le client doit **tester l'archive reçue** après
> renommage et, si elle n'est pas un ZIP valide, retomber sur son ancien cache et signaler
> l'erreur. Alternative temporaire : gérer les deux formats côté client (une librairie
> ZIP + un décompresseur XZ/tar).

### 5.8 `GET /season` — layout « app season » (écran principal)

```
GET /season HTTP/1.1
datas: {"API_TOKEN": "…", "API_REQUEST_TOKEN": "…"}
```

Réponse actuelle (**stub** — à considérer comme volontairement minimal) :

```json
{"appseason": "", "API_REQUEST_TOKEN": "…"}
```

Format attendu une fois branché (source : `seasons/app-seasons/current/appseason.json`
côté serveur) :

```json
{
  "name": "Beta",
  "baseloc": "/seasons/app-seasons/current/images",
  "backgroundBase": "/bg.png",
  "height": 1536,
  "width": 1024,
  "parts": [
    {"action": "Scan", "position": {"x": 20, "y": 20}, "ressouces": "/Fabric.png"},
    {"action": "Home", "position": {"x": 20, "y": 20}, "ressouces": "/Home.png"},
    {"action": "Profile", "position": {"x": 20, "y": 20}, "ressouces": "/Maire.png"},
    {"action": "Arena", "position": {"x": 20, "y": 20}, "ressouces": "/Arena.png"}
  ]
}
```

Le client doit **gérer ce schéma de manière tolérante** : `parts` peut être vide ou le
champ absent (→ layout par défaut du client). Les `action` attendues sont les écrans
Scan / Home / Profile / Arena de l'app.

⚠ Deux pièges littéraux du fichier source :
- la clé de ressource est orthographiée **`"ressouces"`** (faute d'origine — ne la
  renommez pas « ressources » côté client sans valider le changement serveur) ;
- les chemins sont des chemins internes (`/seasons/...`) : avec le serveur actuel, seul
  `./html/` est servi (cf. §2), donc ces images ne sont pas téléchargeables via HTTP.
  À valider au propriétaire : soit une route dédiée pour servir `<baseloc>/<ressources>`,
  soit embarquer les images dans l'app (cf. §12).

### 5.9 `POST /user/renew-password` — mot de passe oublié / renouvellement (sans tokens)

Ajouté le 2026-10-30. À utiliser quand l'utilisateur est **connecté nulle part** (session
morte et mot de passe perdu) — c'est l'écran « mot de passe oublié » de l'app.

**Requête**

```
POST /user/renew-password HTTP/1.1
Content-Type: application/json

{"mail": "joueur@exemple.fr"}
```

**Réponse (succès)**

```json
{"renewed": true}
```

**Effets serveur** :
- validation de la **forme** du mail → sinon `403 {"message": "Forbidden"}` ;
- nouveau mot de passe aléatoire (15 car.) écrit en base
  (`SHA2(CONCAT(mail, clair), 256)`) + `last_action` notifié ;
- e-mail `CodEbara` avec le **nouveau mot de passe en clair** et le contexte
  « renouvellement — votre ancien mot de passe ne fonctionne plus » (même gabarit que
  l'inscription) ;
- la session en cours, s'il y en a une, reste valable (les tokens ne dépendent pas du
  mot de passe) ; seul l'authentification login/pass utilise le nouveau mot de passe.

**Échecs (tous → 403 `{"message": "Forbidden"}`)** : mail mal formé, **ou** compte
inconnu — délibérément la même réponse pour les deux cas (pas d'oracle d'existence de
comptes) : côté client, affichez « si ce compte existe, un mail vient d'être envoyé »
et laissez la réponse de succès masquer la distinction.

**À noter** : la réponse de succès **ne contient pas** `API_REQUEST_TOKEN` (aucun token
n'est émis via cette route) — ne déclenchez pas votre rotation sur cet appel. Le mail
part systématiquement, même en `DEBUG=True` serveur (décision 2026-10-30) ; en DEBUG,
le mot de passe est en outre imprimé dans le log du serveur.

### 5.10 `PUT /user` — mise à jour du profil (« mairie », tokens requis)

Ajouté le 2026-10-30. C'est l'écran « mairie » (Profil) : changement de nickname, de
mail et/ou de mot de passe **par l'utilisateur connecté**. C'est ici
(uniquement ici) que s'applique la règle de complexité du mot de passe.

**Requête** (tous les champs sont optionnels, au moins un requis) :

```
PUT /user HTTP/1.1
datas: {"API_TOKEN": "…", "API_REQUEST_TOKEN": "…"}
Content-Type: application/json

{"nickname": "NouveauPseudo", "mail": "joueur@exemple.fr", "password": "<64 hex>"}
```

**Réponse (succès)** — profil à jour + rotation :

```json
{
  "id": 670, "nickname": "NouveauPseudo", "mail": "joueur@exemple.fr",
  "amount": 6666666666, "hash": "5723…64 hex…",
  "API_REQUEST_TOKEN": "…nouveau…"
}
```

**Règle de mot de passe (validation CÔTÉ CLIENT, obligatoire)** — le serveur reçoit
le mot de passe **déjà haché** et ne peut pas vérifier le clair : c'est le client
qui doit refuser la saisie conforme à la règle avant de hacher :

- au moins **une majuscule** ;
- au moins **une minuscule** ;
- au moins **un caractère spécial** (non alphanumérique, ex. `!$%&+-_@#…`) ;
- **≥ 7 caractères** au total.

Une fois la règle respectée, le client envoie
`password = SHA256(mail_final + motDePasseClair)` — hexadécimal **minuscule**,
64 caractères (§3.2), où `mail_final` est :

- le **nouveau** mail si le body change le mail ;
- le mail **courant** de la session sinon.

Le serveur vérifie uniquement la **forme** du hash ((`[0-9a-f]{64}`) : une autre
forme → `403 Forbidden` (mauvais format — pas une indication de complexité).

**Échecs** :

| Situation | Réponse |
|---|---|
| body vide ou aucun champ connu | `400` `{"message": "Invalid Request with body given for: ..."}` |
| `password` pas hexa min. 64 | `403` `{"message": "Forbidden"}` |
| `mail` mal formé | `403` `{"message": "Forbidden"}` |
| `mail` déjà utilisé par un autre compte | `403` `{"message": "Forbidden"}` |
| `mail` fourni (différent du courant) **sans** `password` | `403` `{"message": "Forbidden"}` |
| tokens invalides/expirés | `400` `{"message": "Invalid REQUEST TOKEN"}` (session morte → re-login) |

⚠ **Pourquoi un mail sans password est refusé (403)** : le hash d'authentification
est `SHA256(mail + clair)` (§3.2) — changer le mail seul rend l'ancien hash
inutilisable au prochain login (compte bloqué). Un changement de mail doit donc
toujours s'accompagner d'un nouveau mot de passe.

Détails : `nickname` vide ou non-chaîne → 400 (corps illisible) ; `last_action` est
notifié côté base ; la session et les tokens **ne dépendent pas** du mot de passe :
aucune reconnexion nécessaire après un `PUT /user` réussi (l'`API_REQUEST_TOKEN`
renouvelé de la réponse reste valable).

### 5.11 `GET /season` / `GET /season/check` — saison d'affichage (tokens requis)

Implémentés côté serveur le 2026-11-17 (branche `opencode` de pyCodebara2) et
**intégrés au client en v0.0.12** (`src/services/saison.ts`, étape splash
« saison d'affichage » — pays = locale du téléphone dans le champ `country`
du header `datas`). Le format du paquet et le flux client sont détaillés dans
`docs/cds-format.md` de ce dépôt ; côté serveur : `docs/seasons.md`
(§ app-seasons).

**Pays de la demande** : champ `country` du header `datas` (ex. `"fr-FR"`,
absent → fallback `intl`). Sélection : saisons actives (`debut ≤ maintenant ≤
fin`) → priorité au pays → plus récente en cas d'ex æquo → `intl` sinon.

**`GET /season/check`** (succès) :

```json
{"appseason": 1, "hash": "0bf0…64 hex…", "API_REQUEST_TOKEN": "…"}
```

**`GET /season`** (succès) :

```json
{"appseason": 1, "hash": "0bf0…64 hex…", "season": "<base64 du .cds>", "API_REQUEST_TOKEN": "…"}
```

**Aucune saison active** (les deux endpoints) : `appseason` **et** `hash` **vides**
(`""`) — le client doit utiliser la saison **embarquée dans sa build** ; token
renouvelé présent quand même. Le `.cds` (~5,9 Mo → base64 ~7,8 Mo) : le décodage
base64 redonne un ZIP dont l'archive contient `season.json` + PNG. Le hash sert
au mobile à comparer avec son `.cds` local (bon → local ; mauvais → télécharger).

### 5.12 `GET /users?value=…` — recherche de joueurs (tokens requis)

Endpoint serveur ajouté le 2026-11-18 (`usersSearchRoute`) et utilisé par la
fenêtre « école » (`src/ecrans/ecole.tsx`, `src/services/api.ts`). Retrouve les
comptes dont le **nickname** ou le **mail** **commence** par `value` :

```
GET /users?value=alex HTTP/1.1
datas: {"API_TOKEN": "…", "API_REQUEST_TOKEN": "…"}
```

- `value` : **4 caractères minimum** (contrôlé client et serveur) ; pas d'espace
  ni de `&`, `=`, `%`, `?`, `#`, `+` — la query string n'est **pas décodée** par le
  serveur, la valeur est envoyée **telle quelle** (pas d'`encodeURIComponent`).
- Réponse 200 : `{"users": [{"id": 693, "nickname": "Alex", "mail": "alex@…",
  "friendStatus": "unknown"}, {"id": 695, "nickname": "Alexis", "mail": "…",
  "friendStatus": "pending"}, {"id": 698, "nickname": "Alix", "mail": "…",
  "friendStatus": "friend"}, …], "API_REQUEST_TOKEN": "…nouveau…"}` — rotation
  du token gérée par `appelProtege`.
  `friendStatus` (ajout 2026-11-19, jointure sur `friend_request`) vaut :
  - `unknown` : aucune relation — bouton « Ajouter » actif dans l'onglet Recherche ;
  - `pending` : demande en cours, **reçue ou envoyée** — bouton « En attente » grisé ;
  - `friend` : amitié validée — indication « Ami », **aucun bouton**.

  La recherche **ne donne jamais accès à la maison** d'un utilisateur : elle ne
  sert qu'à envoyer une demande d'ami. Les maisons ne s'ouvrent que depuis
  l'onglet « Amis » (§5.13/§5.14).
- **Pertinence** (serveur) : correspondance exacte d'abord (casse/accents ignorés),
  puis champ le plus court (le préfixe couvre une plus grande part de la valeur),
  départage par nickname puis `id`. Le client conserve l'ordre reçu et **ne trie
  pas** : le premier résultat est le plus probable.
- **Limite : 5 profils affichés**. Le serveur renvoie les 6 plus pertinents
  (`USER_SEARCH_LIMIT = 6`, valeur relevée le 2026-11-19) ; le client applique
  son propre garde-fou `.slice(0, 5)` pour rester sur la règle produit des
  5 résultats maximum. Tableau vide = aucun compte trouvé, pas une erreur.
- Erreurs : tokens absents/invalides → `400 Invalid REQUEST TOKEN` (session morte,
  re-connexion centralisée dans `api.ts`) ; `value` absente ou < 4 car. → `400`.
- Le mail n'est affiché que dans cet écran explicitement « rechercher un joueur »
  (pas de spam).

### 5.13 `/friend/*` et `/friends` — demandes d'amis (tokens requis)

Ajouté le 2026-11-19 et intégré à l'onglet « Amis » de la fenêtre « école ».
Les identifiants sont des `user.id`. Cycle de vie :

```
A POST /friend/request/{B}   → demande en attente (state=0, daterequest)
B GET  /friend/requested     → voit la demande de A
B DELETE /friend/request/{A} → REFUS  (la ligne disparaît)
   — ou —
B POST /friend/request/{A}   → ACCEPTATION (state=1, dateaccept)
```

- **Une seule relation par couple** : `POST` en double par le même auteur →
  `400 Friend request already exists` ; `POST` vers un ami validé →
  `400 Already friends`.
- **Pas de route `/accept`** : accepter = poster la demande **inverse**
  (même appel `POST /friend/request/{id}` que pour une nouvelle demande).
- **Refuser = `DELETE /friend/request/{idDuDemandeur}`** : ne marche que sur une
  demande **reçue et en attente** (jamais sur une amitié validée, jamais sur sa
  propre demande émise).
- `GET /friend/requested` → `{"requests": [{"id","nickname","mail","daterequest"}, …]}` ;
  tableau vide `[]` si rien. `daterequest` est au format ISO.
- `GET /friends` → `{"friends": [{"id","nickname","mail","cardcount"}, …]}` :
  amis **validés** uniquement, **liste complète** (aucune limite ni pagination),
  triée par nickname puis id. `cardcount` = nombre de cartes de l'ami en base.
- Erreurs métier : `400` (demande soi-même, doublon, déjà amis) ou `404`
  (`Friend request not found`, `User not found`). **Ces réponses contiennent un
  `API_REQUEST_TOKEN` neuf** (contrairement aux autres routes) : cf. §3.3.
- Aucune suppression d'amitié (« unfriend ») n'est exposée pour l'instant.

### 5.14 Maison d'un ami en lecture seule — liste puis cartes unitaires

Ajouté le 2026-11-19 pour la visite des maisons d'amis **validés** (fenêtre
`maison-visite` du client). `{id}` / `{iduser}` est l'id de l'ami donné par
`GET /friends`. Le serveur vérifie d'abord l'amitié validée du couple — un
inconnu ou une demande en attente reçoivent **404 `{"message": "Friend not
found"}`** (avec token roté, §3.3).

**1. Liste légère** — `GET /friend/{id}/cards` :

```http
GET /friend/674/cards HTTP/1.1
datas: {"API_TOKEN": "…", "API_REQUEST_TOKEN": "…"}
```
```json
{"cards": [
  {"id": 812, "cardHash": "…", "cardpower": 120, "health": 80, "attack": 45}
], "API_REQUEST_TOKEN": "…nouveau…"}
```

Aucun `.cdz` dans cette réponse : elle ne sert qu'à énumérer les `id` de la
maison. `listerCartesAmi` (api.ts) ne garde que les métadonnées.

**2. Une carte par id de la liste** — `GET /friend/{iduser}/cards/{idcard}` :

```http
GET /friend/674/cards/812 HTTP/1.1
datas: {"API_TOKEN": "…", "API_REQUEST_TOKEN": "…"}
```
```json
{"card": {
  "id": 812, "cardHash": "…", "cardpower": 120, "health": 80, "attack": 45,
  "card": "<base64 du .cdz>"
}, "API_REQUEST_TOKEN": "…nouveau…"}
```

Le serveur contrôle **l'amitié validée** avec `{iduser}` **et**
**l'appartenance de la carte à `{iduser}`** (`ownerid` en SQL + `id` demandé) :
sinon 404 `{"message": "Friend not found"}` ou `{"message": "Card not found"}`
(avec token roté). `recupererCarteAmi` (api.ts) est appelé en série pour
**chaque carte de la liste** ; `maison-visite-ecran.tsx` affiche pendant ce
temps une **modal de progression** (« Carte 3 sur 12… » + barre d'avancement).
Une carte en échec est signalée sous la grille, sans bloquer les suivantes.

- Chaque `card` est le `.cdz` complet en base64 (~1,9 Mo), avec un **timeout
  dédié de 120 s** (contre 10 s par défaut) : le client le décode **en mémoire
  uniquement** (`extraireApercu` grille, `ouvrirCdz(octets, cardHash)` détail) —
  **jamais** `enregistrerCarte` / `lireCarteLocale` / `majIndex`
  (`collection.ts`), jamais `telechargerCarte` (`GET /card/{id}`), jamais
  `renommerCarte` (`PUT /card/name`). Rien n'est écrit sur l'appareil ; le GC
  libère les octets à la fermeture de la fenêtre.
- **Aucune modification côté serveur** : les routes sont purement sélectives —
  pas de purge des cartes incomplètes (simplement omises de la liste), pas de
  renommage, aucune écriture en base. Les routes du propriétaire
  (`PUT /card/name`, purge de `cardFunction.getCardListOfUser`) ne doivent pas
  être appelées depuis une maison visitée.
- Le couple d'`API_REQUEST_TOKEN` est vérifié puis roté comme sur les autres
  routes `/friend/*`, **y compris sur toutes les erreurs** (métier ou
  inattendue) tant que les tokens présentés étaient valides.

---

### 5.15 Création asynchrone, messagerie et réception des cartes (2026-11-24)

`POST /card` renvoie **toujours** `{cardid}` : l'id définitif est alloué dès la
demande dans la table miroir `card_awaiting_receipt` (état `attente de traitement`,
`fileloc` et `cardHash` vides). La tâche `{id, cb, iduser}` est écrite dans
`content/card_tasks.json` et confiée à un pool de threads dimensionné par
`CARD_POOL_SIZE` (`.env`, défaut 4). À la fin, la tâche est retirée du JSON et
la ligne passe à `achevé` ou `echec` — elle reste en base jusqu'à la réception.
Une notification est créée dans les deux cas.

| Méthode & route | Authentification | Réponse |
|---|---|---|
| `GET /notifications` | tokens du header `datas` **ou**, sans token, `{"iduser": N}` dans le header `datas` (ou `?iduser=N`) | `{"notifications":[{"id","object","date","type","state","cardid"}], "API_REQUEST_TOKEN"?}` — token **jamais** renvoyé ni consommé en mode sans token ; trié du plus récent au plus ancien. **Jamais de corps sur GET** (refusé par `fetch`) |
| `GET /notifications/{id}` | tokens obligatoires (header `datas` ou corps) | `{"notification":{…, "card": "<base64>", "checksum", "reception":{id,state,cb}}}`. Le carte n'est jointe que si `type == "nouvelles cartes"` et l'état `achevé` |
| `PUT /notifications/{id}` | tokens obligatoires | `{"read": true, "state": 1, "API_REQUEST_TOKEN"}` — marque comme lue, **ne supprime pas** la notification |
| `GET /awaiting_cards/{id}` | tokens obligatoires, propriétaire vérifié | Même contenu que `GET /card/{id}` + `{"reception":{id,state,cb}}` ; `404 Card not found` si la carte n'est pas achevée ou le fichier absent |
| `POST /awaiting_cards/{id}` | tokens obligatoires, propriétaire vérifié | Corps optionnel `{"name": "…"}`. Copie la ligne dans `card` avec le **même id**, supprime l'attente + la tâche JSON + la notification, renvoie `{"cardid","card","checksum","API_REQUEST_TOKEN"}` |
| `DELETE /awaiting_cards/{id}` | tokens obligatoires, propriétaire vérifié | Supprime la ligne, le `.cdz`, la tâche JSON et la notification ; `{"deleted": true, "API_REQUEST_TOKEN"}` |

Types de notifications : `nouvelles cartes` (génération achevée) et
`information` (échec). Le client `poste` affiche **l'objet seul** dans la liste,
appelle `PUT /notifications/{id}` à l'ouverture puis `GET /notifications/{id}`.
Une carte achevée impose le choix : `POST` (nom optionnel demandé par une modal)
puis mise en cache `<idUser>/<id>.cdz`, ou `DELETE`. Une carte en échec est
supprimée par `DELETE` dès l'ouverture de sa notification. Le retour est
verrouillé tant qu'une carte achevée n'est pas traitée (en-tête, bouton Android
et historique web). Migration SQL : `migration-card-awaiting.sql` (dépôt serveur).

---

## 6. Cycle de vie client d'une carte (recette complète)

### 6.1 Scénario standard

```
Écran Scan
  tokens de session OK (ou auth au démarrage, §5.2b)
  scan EAN-13 « 64527486384936 »
  POST /card {cb}                                     (headers `datas`)
  ── attente génération (10 s à 2 min) ──
  réponse {card, checksum, cardid, API_REQUEST_TOKEN}
       │
       ├─ API_REQUEST_TOKEN → mettre à jour le store
       ├─ base64 → bytes ; sha256(bytes) == checksum ? sinon abandon (transport corrompu)
       ├─ écrire <cache>/<cardid>.cdz
       ├─ dézipper → front.png, back.png, perso.png, datas.json, deck.json, hashs.json
       ├─ vérifier hashs.json (les 4 sha256 internes) → si écart : re-télécharger via GET /card/{id}
       ├─ affichage de l'« éclosion » (animation `egg.png` recommandée)
       └─ enregistrer dans la collection locale (id → données stats)
```

### 6.2 Les 6 fichiers d'une `.cdz` (ZIP, compression DEFLATED)

| Fichier | Rôle client |
|---|---|
| `front.png` | **image à afficher telle quelle** (600×1037) : elle contient déjà nom, stats, barres, specials et numéro de série rendus serveur |
| `back.png` | dos de la carte (600×1037) |
| `perso.png` | illustration du personnage seule (≤256×256) — utile pour avatars / listes |
| `datas.json` | **stats exploitables par le jeu** (cf. §6.4) |
| `deck.json` | gabarit de positions si vous voulez redessiner la carte vous-même (§6.5) — optionnel |
| `hashs.json` | checksums des 4 fichiers ci-dessus (contrôle local, §6.3) |

### 6.3 Intégrité (sha256)

- **Contrôle global** : sha256(archive) == `checksum` renvoyé à la génération
  == `cardHash` de `GET /card` et peut être re-validé serveur via `GET /card/check`.
- **Contrôles internes** : `hashs.json` = `{"front": "<64 hex>", "perso": "<64 hex>",
  "datas": "<64 hex>", "back": "<64 hex>"}` → vérifiez chaque fichier extrait après tout
  téléchargement ; tout écart = fichier corrompu → re-télécharger.
- **Piège du renommage** : après `PUT /card/name`, `hashs.json.datas` et le hash global
  sont recalculés côté serveur — **re-vérifiez** l'archive reçue (et cf. §5.7 sur le
  bug tar.xz).

### 6.4 `datas.json` (exemple réel)

```json
{
  "id": 742,
  "creatorid": 670, "ownerid": 670, "seasonid": 0,
  "name": "",
  "attack": 75, "health": 62, "rarity": 1.0, "power": 100,
  "specials": [
    {"name": "Energy drink", "attack": 88, "health": 50, "turn": 1},
    {"name": "Energy drink", "attack": 88, "health": 50, "turn": 1}
  ]
}
```

- `id` = numéro de carte ; `name` = nom choisi (vide à la génération, rempli par
  `PUT /card/name`) ; `seasonid` = univers ; `specials[]` = effets (nom, attaque/santé
  modifiés — un des deux peut être `null` — et `turn` = durée en tours).
- Le client doit tolérer : `name` vide, specials vides (`[]`), champs additionnels futurs.

### 6.5 `deck.json` (rendu libre, optionnel)

```json
{
  "frontUrl": "front.png", "backUrl": "back.png", "persoUrl": "perso.png",
  "width": 600, "height": 1037,
  "positions": {
    "name":    {"x": 26,  "y": 41,  "height": 46, "color": "#0F0FAB"},
    "health":  {"x": 160, "y": 656, "height": 24, "color": "#0F0FAB"},
    "healthbar": {"x": 218, "y": 654, "height": 26, "width": 330, "color": "#0F0FAB"},
    "attack":  {"x": 160, "y": 707, "height": 24, "color": "#0F0FAB"},
    "attackbar": {"x": 218, "y": 704, "height": 26, "width": 330, "color": "#0F0FAB"},
    "special": {"x": 44,  "y": 798, "height": 26, "color": "#0F0FAB"},
    "image":   {"x": 28,  "y": 93,  "width": 545, "height": 502, "color": "#0F0FAB"},
    "id":      {"x": 13,  "y": 1012, "height": 18, "color": "#FAFAFAFA"}
  }
}
```

- Le rendu **recommandé pour la v1 = afficher `front.png` tel quel** (le serveur le
  dessine déjà complet). `deck.json` servira si vous voulez redessiner la carte
  dynamiquement (redimensionner, changer le nom localement, dark mode…).
- Les barres (`healthbar`/`attackbar`) sont proportionnelles à 0–100 (`cardpower`) —
  le fichier serveur est déjà conforme ; si vous redessinez, tracé = **cercle plein**
  (`ellipse` dans le code) positionné à `x + value*(width-height)/100`.
- Les polices serveur (ArianaVioleta, GalaferaMedium) ne sont **pas** distribuées dans
  le `.cdz` — si vous redessinez hors serveur, choisissez des polices libres proches
  (ou demandez au serveur de les embarquer).
- tolérance : **toute clé peut manquer** (`special`, `healthbar`, `power`…) ;
  n'essayez aucun cast strict.

### 6.6 Collection et cache

- Cache : `<cacheDir>/cards/<cardid>.cdz` + index local (id → stats locale) ;
  à chaque démarrage, rattraper avec `GET /card` (tri et exclusion des doublons).
- Détails complémentaires à venir côté serveur : tri, recherche, échange de cartes
  (rien de disponible en oct. 2026) — le client doit gérer ces limitations gracieusement.

---

## 7. Code-barres : ce que le client doit scanner

- Symbologies officiellement retenues au lancement : **EAN-13** (13 chiffres),
  UPC-A (12 chiffres), EAN-8 (8 chiffres) — tout code numérique sans séparateur.
- **Envoyez toujours la chaîne complète** (chiffres de gauche à droite, zéros
  significatifs inclus). Le tirage de la carte dépend de parties précises du code :
  une longueur ou une mauvaise lecture = une **autre carte** (et non une erreur).
- La **checksum EAN-13** n'est pas vérifiée serveur (elle ne sert qu'aux lecteurs) :
  le code imprimé inclut déjà son chiffre de contrôle final — envoyez les **13
  chiffres** tels qu'imprimés.
- Recommandé : gérer la double validation EAN-13 (checksum mod 10) côté client pour
  repérer les mauvaises lectures avant l'envoi.

---

## 8. Séquences de code (exemples prêts à adapter)

### 8.1 cURL (test de recette)

```bash
HOST=http://localhost:8080

# 1. créer un compte (dev : le mot de passe n'est PAS envoyé ; cf. §12.1)
curl -s -X POST "$HOST/user" -H 'Content-Type: application/json' \
     -d '{"mail":"test@codebara.com"}'

# 2. auth par tokens (avec les tokens obtenus ci-dessus)
curl -s "$HOST/user/auth" \
     -H 'datas: {"API_TOKEN":"<…>","API_REQUEST_TOKEN":"<…>"}'

# 3. liste des cartes
curl -s "$HOST/card" \
     -H 'datas: {"API_TOKEN":"<…>","API_REQUEST_TOKEN":"<…>"}'

# 4. générer une carte (attente possible ~minutes; IA serveur requise)
curl -s -X POST "$HOST/card" \
     -H 'Content-Type: application/json' \
     -H 'datas: {"API_TOKEN":"<…>","API_REQUEST_TOKEN":"<…>"}' \
     -d '{"cb":"64527486384936"}'

# 5. une carte précise
curl -s "$HOST/card/844" \
     -H 'datas: {"API_TOKEN":"<…>","API_REQUEST_TOKEN":"<…>"}'

# 6. renommer
curl -s -X PUT "$HOST/card/name" \
     -H 'Content-Type: application/json' \
     -H 'datas: {"API_TOKEN":"<…>","API_REQUEST_TOKEN":"<…>"}' \
     -d '{"cid":844,"name":"Test"}'

# 7. checker le fichier
sha256sum 844.cdz   # doit == checksum renvoyé / cardHash de GET /card
```

### 8.2 TypeScript (web, fetch)

```ts
const BASE = "http://localhost:8080";

// stockage des tokens (remplacez par un store sûr côté web / natif)
let tokens = { API_TOKEN: "", API_REQUEST_TOKEN: "" };

function datasHeader(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...tokens, ...extra });
}

function sha256Hex(s: string): string {
  // WebCrypto est async : implémentez avec crypto.subtle.digest('SHA-256', …)
  // en Promise → hex minuscule ; sha256Bytes est le même principe sur un buffer
  throw new Error("stub à implémenter (§3.2)");
}

async function login(mail: string, clearPassword: string) {
  const password = await sha256Hex(mail + clearPassword); // §3.2
  const r = await fetch(`${BASE}/user/auth`, {
    headers: { datas: JSON.stringify({ mail, password }) },
  });
  if (!r.ok) throw new Error(await r.text());           // corps = texte
  const d = await r.json();
  tokens.API_TOKEN = d.API_TOKEN;
  tokens.API_REQUEST_TOKEN = d.API_REQUEST_TOKEN;       // les DEUX sont ré-émis ici
  return d;                                             // {id, nickname, mail, amount, hash}
}

async function authByTokens() {
  const r = await fetch(`${BASE}/user/auth`, { headers: { datas: datasHeader() } });
  if (!r.ok) return null;                               // session morte → login complet
  return r.json();                                      // données user uniquement
}

async function generateCard(cb: string): Promise<Card> {
  const r = await fetch(`${BASE}/card`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      datas: datasHeader(),
    },
    body: JSON.stringify({ cb }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw t.includes("Invalid REQUEST TOKEN")
      ? new SessionExpired()
      : new GenerationUnavailable(t);                    // IA hors service… (§9.2)
  }
  const d = await r.json();
  tokens.API_REQUEST_TOKEN = d.API_REQUEST_TOKEN;        // ROTATION : toujours appliquer
  return d;                                              // {card?, checksum?, cardid}
}

async function saveCdz(base64: string, cardid: number, checksum: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const digest = await sha256Bytes(bytes);
  if (digest !== checksum) throw new Error("transport corrompu");
  // … écrire les octets dans <cacheDir>/<cardid>.cdz, puis §6.1 : unzip + contrôle hashs.json
}
```

### 8.3 Kotlin (Android, OkHttp — esquisse)

```kotlin
val http = OkHttpClient.Builder()
    .callTimeout(120, TimeUnit.SECONDS)     // POST /card peut durer longtemps
    .readTimeout(120, TimeUnit.SECONDS)
    .build()

val MEDIA_JSON = "application/json; charset=utf-8".toMediaTypeOrNull()

fun buildDatas(extra: Map<String, String> = emptyMap()): String =
    JSONObject(tokens + extra).toString()   // tokens est un Map<String, String>

// header datas toujours présent sur les routes protégées
fun buildRequest(path: String, method: String, bodyJson: String? = null,
                 extraDatas: Map<String, String> = emptyMap()): Request {
    val b = Request.Builder()
        .url("http://10.0.2.2:8080$path")
        .header("datas", JSONObject(tokens + extraDatas).toString())
    when (method) {
        "POST" -> b.post(bodyJson!!.toRequestBody(MEDIA_JSON))
        "PUT"  -> b.put(bodyJson!!.toRequestBody(MEDIA_JSON))
        else   -> b.get()
    }
    return b.build()
}

fun applyRotation(body: JSONObject) {           // TOUS les succès des routes protégées
    body.optString("API_REQUEST_TOKEN")
        .takeIf { it.isNotEmpty() }
        ?.let { tokensStore.updateRequestToken(it) }
}

// le sha256 du mot de passe (§3.2)
fun hashPassword(mail: String, clear: String): String =
    (MessageDigest.getInstance("SHA-256")
        .digest((mail + clear).toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) })    // hex minuscule
```

> Ajouter les dépendances réelles `kotlinx.serialization`/`moshi`/`Gson`
> selon la stack du client ; l'essentiel : **un seul intercepteur** qui injecte
> le header `datas` et applique la rotation de la réponse **automatiquement**.
> EncryptedSharedPreferences pour le stockage des tokens.

---

## 9. Points d'attention / situations limites

### 9.1 Session

- La session s'exprime **par le couple** `API_TOKEN` + `API_REQUEST_TOKEN` — aucune
  « persistence » de session côté serveur, pas d'expiration d'horloge : c'est la rotation
  qui rend le token ancien inexploitable. Un `API_TOKEN` seul ne suffit pas.
- Deux appels **parallèles** avec le **même** token : le second échouera
  (« Invalid REQUEST TOKEN » car le premier appel a déjà fait tourner le token).
  Sérialisez les appels protégés côté client (file d'attente) ou étendez le serveur
  plus tard.

### 9.2 Génération de carte impossible

En configuration de dev actuelle, le serveur IA externe (FastSDCPU) peut ne pas tourner :
`POST /card` renvoie alors un 400 `{"message": "Invalid Request with body given for: ..."}`
(puisque l'exception interne est masquée). Reconnaître ce cas :
- afficher « génération indisponible, réessayez plus tard » et **ne déclenchez pas** de
  re-connexion (le token reste bon) ;

### 9.3 Endpoints encore absents

`GET /user`, `GET /user/{id}`, `GET /season/check`… renvoient aujourd'hui
400/404 texte. Structurez le client pour les **ignorer proprement** (feature flags)
et activer les features dès qu'ils arrivent au serveur (suivre `docs/api.md`).

### 9.4 L'archive (`.cdz`) est unique côté serveur

`POST /card` réutilise l'illustration déjà générée pour un même utilisateur + saison +
code-barres : deux scans du même code par le même joueur dans la même saison donnent
la **même carte** (hors raretés spéciales). Ce n'est pas un bug — le joueur peut
scanner le même code-barres plusieurs fois ; seule l'illustration est réutilisée, le
reste du tirage est identique par construction (déterminisme de la saison).

### 9.5 Tailles & précisions d'affichage

- front/back : 600×1037 px ; perso : réduite à `thumbnail((256, 256))` (ratio conservé,
  donc au plus 256 px dans chaque dimension).
- Conservez un facteur d'échelle basé sur `deck.json.width/height` si vous
  redessinez la carte à une autre échelle.

---

## 10. Checklist d'implémentation client

- [ ] Constantes : header `datas`, clés `API_TOKEN`/`API_REQUEST_TOKEN` (casse exacte)
- [ ] Requêtes : JSON compact, `Content-Type: application/json`, `cb` en chiffres
- [ ] Auth : `sha256Hex(mail + clearPassword)` minuscule (§3.2), deux modes `GET /user/auth`
- [ ] Rotation : intercepteur qui lit `API_REQUEST_TOKEN` dans le corps → stockage
      après **chaque** succès de route protégée (et *seulement* alors)
- [ ] File d'attente des appels protégés (pas de parallélisme avec le même token)
- [ ] Erreurs : statut 400/404 + corps `{"message": "…"}` ; re-connexion de session
      **uniquement** sur « Invalid REQUEST TOKEN »
- [ ] Décodage `.cdz` (ZIP), contrôle sha256 global + `hashs.json` internes
- [ ] Affichage : `front.png`/`back.png` bruts, stats depuis `datas.json`,
      **rendu libre si deck.json (optionnel, tolérant aux clés manquantes)**
- [ ] Cache collection + `GET /card` de synchronisation au démarrage
- [ ] Écran « mot de passe oublié » : `POST /user/renew-password` (§5.9, message
      neutre pour ne pas révéler si le compte existe)
- [ ] Écran « mairie » : `PUT /user` (§5.10) — validation locale de la règle de
      mot de passe (majuscule + minuscule + spécial + ≥7 car.) **avant** hachage
      `SHA256(mail_final + clair)` ; changer le mail ⇒ nouveau password obligatoire
- [ ] Intégrer `PUT /card/name` avec garde-fou anti tar.xz (§5.7)
- [ ] `GET /season` : parsing opportuniste, layout par défaut si absent
- [ ] Fenêtre « école » : onglet Recherche (`GET /users`, `friendStatus` →
      Ajouter / En attente / Ami, **aucun accès maison**) + onglet Amis (§5.12/§5.13)
- [ ] Amis : demandes repliables (accepter = POST inverse, refus = DELETE du
      demandeur), liste des amis validés cliquable → maison visitée (§5.13)
- [ ] Rotation du token **sur les erreurs `/friend/*`** aussi (§3.3) : lire
      `API_REQUEST_TOKEN` dans le corps d'erreur et le stocker
- [ ] Maison visitée : `GET /friend/{id}/cards` (liste) puis
      `GET /friend/{iduser}/cards/{idcard}` pour chaque carte, modal de
      progression, `.cdz` décodés **en mémoire seulement** (aucun appel à
      `collection.ts`, `GET /card/{id}` ou `PUT /card/name`) — lecture seule (§5.14)
- [ ] Tests de recette : §8.1 (curl) reproductibles + intégration app

---

## 11. Journal des évolutions de contrat

| Date | Événement |
|---|---|
| 2026-10-30 | Contrat établi d'après le code serveur de pyCodebara2 + `endpoints.odt` ; décision owner : **ZIP définitif** pour `.cdz` (renommage serveur à aligner) |
| 2026-10-30 | Authentification mail de bienvenue : SMTP configuré via `.env` (`SMTP_*`), mail HTML `CodEbara` (template `codebara/templates/newUserMail.html`) envoyé au `POST /user` réussi ; en `DEBUG=True`, mot de passe imprimé dans le log serveur |
| 2026-10-30 | Nouveau `POST /user/renew-password` (mot de passe oublié) ; `POST /user` refuse mail mal formé ou compte existant avec **403 Forbidden** ; colonne `user.last_action` (DATETIME, ON UPDATE) — cf. §5.9 |
| 2026-10-30 | **Envoi des mails systématique, même en `DEBUG=True`** (fin de l'ancien comportement « pas d'envoi en DEBUG ») ; en DEBUG le mot de passe reste en outre imprimé dans le log serveur |
| 2026-10-30 | Nouveau `PUT /user` (« mairie ») : maj nickname/mail/password via tokens ; règle de mot de passe (majuscule + minuscule + spécial + ≥7 car.) appliquée **côté client**, mot de passe envoyé `SHA256(mail_final + clair)` hexa min. 64 ; changement de mail ⇒ password requis — cf. §5.10 |
| 2026-11-19 | **`GET /users?value=` intégré au client** (fenêtre « école ») : recherche par début de nickname ou de mail, **4 car. minimum**, **5 résultats max** affichés (serveur `USER_SEARCH_LIMIT = 6` relevé depuis), triés par pertinence ; suppression de la liste fictive affichée jusque-là — cf. §5.12 |
| 2026-11-19 | **Système d'amis intégré** (onglets de l'école) : `POST`/`DELETE /friend/request/{id}`, `GET /friend/requested`, `GET /friends`, `friendStatus` sur `/users` ; token roté même sur erreur métier — cf. §3.3 et §5.13 |
| 2026-11-19 | **`GET /friend/{id}/cards`** : maison d'un ami validé en **lecture seule**, cartes en base64 décodées en mémoire, sans stockage local ni modification (§5.14) |
| 2026-11-19 | **Chargement en deux temps** : la liste ne contient plus que des métadonnées ; nouveau `GET /friend/{iduser}/cards/{idcard}` par carte, contrôles serveur ami/appartenance, modal de progression côté client, token roté sur **toutes** les réponses `/friend/*`. Aucun stockage persistant, **aucune incrémentation de version** (§3.3, §5.14) |
| à venir | `GET /user`, mode génération asynchrone, tables de sécurité anti-rejeu, HTTPS |

---

## 12. À valider / demander au propriétaire du serveur

1. **Mails toujours envoyés, même en `DEBUG=True`** (état 2026-10-30) : `POST /user`
   et `POST /user/renew-password` envoient systématiquement l'e-mail (comportement
   DEBUG aligné sur la production). En configuration de développement, le mot de passe
   généré est **en outre imprimé dans le log du serveur**
   (`[DEBUG] Mail de ... envoyé...`) : pratique pour les tests de recette sans boîte
   mail. *Ne pas* implémenter de contournement client côté mot de passe (l'API ne
   transmet jamais le mot de passe). Le changement **volontaire** de mot de passe
   par l'utilisateur connecté passe désormais par `PUT /user` (« mairie », §5.10)
   avec la règle de complexité ; le « mot de passe oublié » sans session reste
   `POST /user/renew-password` (§5.9).
2. **HTTPS / proxy** : actuellement `http://` — éviter d'envoyer les tokens sur du réseau
   non confidentiel hors dev ; demander un reverse-proxy TLS au besoin.
3. **Corps d'erreur JSON** (optionnel mais recommandé) : le texte brut rend la
   reconnaissance d'erreurs fragile ; demander au serveur des erreurs JSON
   `{"status": 400, "message": "…"}` tout en gardant le statut correspondant (`+ token`).
4. **Nouveau statut mid-génération** : quand la génération passera asynchrone, négocier
   le « polling » (`GET /card/{id}` jusqu'à disponibilité) ou un webhook, et un état
   « en cours » décelable côté `GET /card` (state 0 vs état visible).
5. **Consolidation `GET /card/{id}`** : la route ne vérifie pas l'appartenance de la
   carte à l'utilisateur connecté (n'importe quel token valide lit n'importe quel id) —
   à confirmer ou corriger côté serveur avant l'ouverture au public.
6. **Assets app season** (cf. §5.8) : servir `<baseloc>/<ressources>` via HTTP, ou
   laisser le client embarquer les images ; et trancher le rename de la clé
   `"ressouces"`.
