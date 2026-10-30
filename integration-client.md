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
  ⚠ Le serveur génère un mot de passe aléatoire et l'envoie **par e-mail**
  uniquement si `DEBUG=False` côté serveur ; en configuration de développement
  actuelle (`DEBUG=True`), **aucun mot de passe n'est transmis au client** — voir §12.1.
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
| toute route protégée réussie (`/card/*`, `/season`) | un **nouveau** `API_REQUEST_TOKEN` **dans le corps JSON** de la réponse (champ `API_REQUEST_TOKEN`) | **remplacer** le `API_REQUEST_TOKEN` stocké ; conserver `API_TOKEN` |
| erreur applicative (corps `{"message": …}` 400/404) | **pas de données ni de token**, donc pas de renouvellement | **conserver** le dernier token valide (la rotation n'a lieu que si la route se termine en succès complet ; ne pas s'attendre à un token dans une réponse d'erreur) |
| erreur token invalide (routes `/card`, message 400 « Invalid REQUEST TOKEN ») | corps `{"message": "Invalid REQUEST TOKEN"}` | session perdue → déclencher la re-connexion login/pass (sur `/user/auth` l'échec est un 404, cf. §5.2) |

Règle d'or : **le `API_REQUEST_TOKEN` utilisable est toujours celui renvoyé par le dernier
appel protégé réussi**. Un token périmé ne sert plus jamais.

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
| `/user` | GET (user connecté) | tokens | ✗ prévu (404) |
| `/user/{id}` | GET | tokens | ✗ prévu (404) |
| `/user` | PUT (maj profil) | tokens | ✗ prévu (404) |
| `/card` | POST (générer) | tokens | **✔ actif** |
| `/card` | GET (liste) | tokens | **✔ actif** |
| `/card/{id}` | GET (une carte) | tokens | **✔ actif** |
| `/card/check` | GET (checksum) | tokens | **✔ actif** |
| `/card/name` | PUT (renommer) | tokens | **✔ actif** |
| `/season` | GET (app season) | tokens | ✔ **stub** (renvoie `{"appseason": ""}`) |
| `/season/check` | GET | tokens | ✗ prévu (404) |
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
au plus vite depuis la mairie ») si `DEBUG=False` ; retourne les deux tokens.
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
- Durée de réponse : plusieurs secondes à ~1–2 minutes (génération d'illustration IA
  **synchrone** dans la configuration actuelle). Mettre un timeout client généreux (§2).
- Si le serveur d'IA est arrêté (configuration actuelle de dev) : 400
  `{"message": "Invalid Request with body given for: ..."}` — traité comme « service de
  génération indisponible » (§9.2).

**Réponse (succès, génération synchrone — mode test actuel)**

```json
{
  "cardid": 857,
  "checksum": "7df7fe5b…64 hex…",
  "card": "<base64 du fichier .cdz>",
  "API_REQUEST_TOKEN": "…nouveau…"
}
```

- `card` = archive `.cdz` (ZIP) encodée base64 — décodez en binaire, écrivez sur disque
  `…/857.cdz` (nom recommandé : `<cardid>.cdz`), vérifiez `sha256(bytes) == checksum` (§6.3).
- `cardid` = identifiant définitif de la carte (utilisé par les autres endpoints et
  le nom du fichier).

**Réponse (succès, génération asynchrone — mode production à venir)**

```json
{"cardid": 857, "API_REQUEST_TOKEN": "…"}
```

Le fichier `.cdz` devra alors être récupéré via `GET /card/{id}` une fois la
finalisation **terminée** (mécanisme de notification client non encore écrit côté
serveur : interrogez `GET /card` et vérifiez la présence de la carte). La spec
d'origine (`endpoints.odt`) prévoyait la réponse complète en mode synchrone —
implémentez les **deux** formes : si `card` est présent, utilisez-le ; sinon, rendez
le client apte à aller chercher le fichier plus tard.

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
n'est émis via cette route) — ne déclenchez pas votre rotation sur cet appel. En mode
`DEBUG=True` serveur, le mail n'est pas envoyé et le mot de passe est imprimé dans le
log du serveur.

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

`GET /user`, `GET /user/{id}`, `PUT /user`, `GET /season/check`… renvoient aujourd'hui
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
- [ ] Intégrer `PUT /card/name` avec garde-fou anti tar.xz (§5.7)
- [ ] `GET /season` : parsing opportuniste, layout par défaut si absent
- [ ] Tests de recette : §8.1 (curl) reproductibles + intégration app

---

## 11. Journal des évolutions de contrat

| Date | Événement |
|---|---|
| 2026-10-30 | Contrat établi d'après le code serveur de pyCodebara2 + `endpoints.odt` ; décision owner : **ZIP définitif** pour `.cdz` (renommage serveur à aligner) |
| 2026-10-30 | Authentification mail de bienvenue : SMTP configuré via `.env` (`SMTP_*`), mail HTML `CodEbara` (template `codebara/templates/newUserMail.html`) envoyé au `POST /user` réussi ; en `DEBUG=True`, mot de passe imprimé dans le log serveur |
| 2026-10-30 | Nouveau `POST /user/renew-password` (mot de passe oublié) ; `POST /user` refuse mail mal formé ou compte existant avec **403 Forbidden** ; colonne `user.last_action` (DATETIME, ON UPDATE) — cf. §5.9 |
| à venir | `GET /user`, `PUT /user`, `GET /season/check`, mode génération asynchrone, tables de sécurité anti-rejeu, HTTPS |

---

## 12. À valider / demander au propriétaire du serveur

1. **DEBUG=True bloque les mails** (état 2026-10-30) : en configuration de
   développement, `POST /user` et `POST /user/renew-password` n'envoient pas d'e-mail ;
   le mot de passe généré est **imprimé dans le log du serveur**
   (`[DEBUG] Mail de ... non envoyé...`). Pour recruter un compte de test : lire ce log,
   ou demander à l'owner la vraie route (envoi réel avec SMTP configuré).
   *Ne pas* implémenter de contournement client. Le changement de mot de passe visé par
   le mail (« mairie » = écran Profil) suppose `PUT /user` — pas encore implémenté côté
   serveur ; en attendant, le renouvellement (`POST /user/renew-password`) est le seul
   chemin serveur pour redonner un mot de passe.
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
