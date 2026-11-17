# Format `.cds` — paquet de saison d'affichage de l'application

> Créé le 2026-11-17. **Statut : format défini + paquet produit + serveur
> implémenté + INTÉGRATION CLIENT v0.0.12** (splash → étape « saison
> d'affichage », cf. § Flux client).

Le `.cds` (« **c**od**e**bara **s**eason ») est un **ZIP** (même mécanique que
le `.cdz`, décompressable identiquement en web et mobile, cf.
`cdz-pipeline.md`) qui décrit la **saison d'affichage** de l'application :
le fond de la fenêtre principale, les bâtiments dessinés dessus et la fenêtre
que chacun ouvre.

⚠︎ Ne pas confondre avec les **saisons de génération** du serveur
(`seasons/<nom>/season.json` — prompts, table de tirage, template de carte,
cf. `docs/seasons.md` du dépôt serveur). Le `.cds` ne concerne que
l'**habillage client**.

## Contenu du paquet

```
saison-1.cds (ZIP, DEFLATED)
├── season.json        ← descripteur (obligatoire, unique)
├── background.png     ← fond (référencé par fond.fichier)
├── usine.png          ← bâtiments (référencés par batiments.<fen>.fichier)
├── maison.png
├── boutique.png
└── arene.png
```

- Tous les fichiers sont **à la racine** du ZIP (pas de sous-répertoire),
  comme le `.cdz`.
- Les ressources sont des PNG ; `season.json` doit être encodé en UTF-8.
- Chaque `fichier` référencé par `season.json` DOIT exister dans le ZIP.

## `season.json`

```json
{
  "id": 1,
  "nom": "saison 1",
  "pays": "fr-FR",
  "debut": "2026-11-17T00:00:00Z",
  "fin": "2027-12-31T23:59:59Z",
  "fond": {
    "fichier": "background.png",
    "largeur": 992,
    "hauteur": 1586
  },
  "batiments": {
    "usine":    { "fichier": "usine.png",    "x": 132.31542, "y": 6.8262261,  "largeur": 794, "hauteur": 580, "fenetre": "usine" },
    "maison":   { "fichier": "maison.png",   "x": 4.2538008, "y": 552.9937,   "largeur": 453, "hauteur": 378, "fenetre": "maison" },
    "boutique": { "fichier": "boutique.png", "x": 271.01132, "y": 996.76222,  "largeur": 525, "hauteur": 350, "fenetre": "boutique" },
    "arene":    { "fichier": "arene.png",    "x": 441.15388, "y": 658.88353,  "largeur": 537, "hauteur": 449, "fenetre": "arene" }
  }
}
```

| Champ | Type | Rôle |
|---|---|---|
| `id` | entier | Identifiant de la saison d'affichage (indépendant des seasonid de génération). |
| `nom` | texte | Nom affichable. |
| `pays` | texte | Code de locale (`fr-FR`) ou **`intl`** pour une saison internationale. |
| `debut` / `fin` | texte | Dates-heures ISO 8601 (UTC, suffixe `Z`). La saison est **courante** quand `debut ≤ maintenant ≤ fin`. |
| `fond` | objet | Image de fond + **dimensions d'origine** : le repère de toutes les coordonnées de bâtiments est celui de cette image (ici 992×1586 = `CARTE_VIEWBOX`, cf. `src/data/carte.ts`). |
| `batiments` | objet | **Clé = nom du bâtiment** ; une entrée par fenêtre possédant un bâtiment. Une fenêtre sans bâtiment n'apparaît PAS (mairie, notes… accessibles via le menu). |

Chaque bâtiment : `fichier` (PNG dans le ZIP), `x`/`y` (position du coin
haut-gauche dans le repère du fond), `largeur`/`hauteur` (taille d'origine,
redimensionnable par le client), `fenetre` (fenêtre à ouvrir au clic — valeur
de `Fenetre.nom`, cf. `src/navigation/navigateur.ts`).

Règles d'accès (décision produit) : les bâtiments **avec** ressource visuelle
sont ouvrables **par clic sur l'image** dans la fenêtre principale **et** par
le menu principal ; ceux **sans** ressource visuelle le sont uniquement par le
menu.

## Sélection de la saison courante (serveur)

Le serveur indexe les `.cds` de `seasons/app-seasons/` dans
`seasons/app-seasons/index.json` (dates, pays, nom, hash) et choisit, pour une
demande donnée :

1. saisons **actives** (`debut ≤ maintenant ≤ fin`) ;
2. priorité à celle dont le **pays correspond à la demande** (champ `country`
   du header `datas`, ex. `"fr-FR"`) ;
3. si plusieurs restent : la **plus récente** (`debut` le plus tardif) ;
4. si aucune ne correspond au pays : la saison **`intl`** active (la plus
   récente s'il y en a plusieurs) ;
5. **aucune saison active** → le serveur répond au client qu'il doit utiliser
   la saison **embarquée dans la build**.

## Endpoints serveur (protégés tokens, cf. contrat §3)

| Endpoint | Réponse |
|---|---|
| `GET /season/check` | `{ "appseason": "<id ou vide>", "hash": "<sha256 du .cds>", "API_REQUEST_TOKEN": "…" }` — le client compare avec le hash de son `.cds` local. `appseason` vide → aucune saison active → saison embarquée. |
| `GET /season` | `{ "appseason": "<id>", "season": "<.cds en base64>", "API_REQUEST_TOKEN": "…" }` — contenu complet du paquet de la saison courante. |

Le client mobile envoie son `country` dans le header `datas` ; sans pays connu
le serveur applique la règle `intl`. La version web fait **toujours**
`GET /season` (pas de cache local).

### Flux client (implémenté v0.0.12, cf. `src/services/saison.ts`)

Le pays de la demande est la **locale du téléphone** (`expo-localization`,
ex. « fr-FR », `paysDemande()`), envoyée dans le champ `country` du header
`datas`. L'affichage courant vit dans une variable de module
(`saisonAffichageCourante()`) que le splash charge juste avant la fenêtre
principale (étape « saison d'affichage » du chargement).

- **Mobile** : `.cds` local (`<documentDirectory>/saison.cds`, sandbox privé)
  → sha256 vérifié via `GET /season/check` ; hash bon **et** `appseason`
  présent → saison locale ; hash en écart, pas de saison locale, archive
  illisible → `GET /season`, **stockage local immédiat** puis affichage.
- **Web** : **toujours `GET /season`** (aucun stockage local, data URIs PNG).
- **Aucune saison** (`appseason` vide), archive non conforme, **panne
  réseau** → **saison embarquée dans la build** (`CARTE_ZONES`/assets
  `carte/`, le rendu d'origine). `chargerSaisonAffichage()` ne lève JAMAIS :
  l'habillage ne bloque pas la connexion.

Côté rendu : `carte-interactive.tsx` est générique (viewbox + zones passés en
props) ; `principal.tsx` construit les zones depuis la saison courante avec
le garde-fou fenêtre (`ZONES` — une `fenetre` du season.json sans
correspondance est ignorée). Images du `.cds` : fichiers cache natif
(`<cache>/saisons/<fichier>`) ou data URI base64 web.

## État des lieux

| Élément | État |
|---|---|
| `saison-1.cds` (racine de ce projet) | ✔ produit — id 1, « saison 1 », `fr-FR`, 2026-11-17 → 2027-12-31, ressources = `assets/carte/` (background 992×1586 + usine/maison/boutique/arene aux coordonnées de `CARTE_ZONES`). sha256 : `0bf03c604572d2923ada64fd4445b8a33d82695263f82136e37b185ac625f99a` |
| Serveur (pyCodebara2, branche `opencode`) | ✔ index JSON + watcher async + `GET /season/check` + `GET /season` |
| Client (app) | ✔ **implémenté v0.0.12** — `src/services/saison.ts` (stockage + vérification + affichage), étape splash « saison d'affichage », rendu générique `carte-interactive.tsx`, `expo-localization` ajouté (locale → `country`) |
| `.gitignore` | ✔ `*.cds` ignoré (comme `*.cdz`, paquet binaire livré au serveur) |
