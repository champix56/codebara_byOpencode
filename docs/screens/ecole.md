# École — recherche de joueurs et amis

## Rôle

Deux onglets dans la même fenêtre :

- **Recherche** : trouver un joueur par **début de nickname ou de mail** (`GET
  /users?value=…`, 4 car. minimum, 5 résultats max triés par pertinence) et lui
  envoyer une demande d'ami. Aucun résultat fictif. **Aucun accès à la maison**
  depuis cet onglet.
- **Amis** : traiter les demandes reçues (accepter / refuser) et ouvrir la maison
  des amis **validés** en lecture seule (`maison-visite`).

## Structure visuelle

- En-tête commun `EnteteEcran` : titre « École » + chevron de retour (ajouté par
  `App.tsx`).
- Barre d'onglets en haut : « Recherche » (actif par défaut) / « Amis (n) » avec
  le nombre d'amis validés. L'onglet Amis charge demandes + amis à la première
  visite.

### Onglet Recherche

- Bloc blanc : libellé « Rechercher un joueur », rappel « nickname ou e-mail ·
  4 caractères minimum · 5 résultats maximum », champ texte (sans
  autocapitalisation ni correction) et bouton « Chercher » (désactivé si saisie
  invalide ou recherche en cours ; `Entrée` déclenche aussi la recherche).
- Aide sous le champ si moins de 4 car. ou caractère interdit (espace, `&`, `=`,
  `%`, `?`, `#`, `+` : la query string n'est pas décodée côté serveur).
- Liste d'une ligne par joueur : pastille initiale, nickname, mail, puis **une
  seule** action selon `friendStatus` :
  - `unknown` → bouton bleu « Ajouter » (envoie `POST /friend/request/{id}`) ;
  - `pending` → pastille grise « En attente » (demande reçue **ou** envoyée) ;
  - `friend` → badge vert « Ami », **aucun bouton**, et surtout **aucun clic
    ouvrant une maison**.
- Indicateur de chargement, message d'erreur (rouge) / d'information (gris),
  titre « N joueur(s) trouvé(s) ».

### Onglet Amis

- Section **repliable** « Demandes reçues (n) » (chevron ▾/▸, ouverte par défaut)
  : une ligne par demande avec nickname, mail, date, et **deux boutons** —
  « Accepter » (`POST /friend/request/{id}`, la POST inverse bascule l'amitié en
  validée) et « Refuser » (`DELETE /friend/request/{id}` du demandeur). Vide :
  « Aucune demande en attente. »
- En dessous, « Mes amis (n) » : une ligne par ami validé (pastille, nickname,
  mail, nombre de cartes, chevron `›`), **toute la ligne est cliquable** →
  `naviguer({ nom: 'maison-visite', amiId, nickname })`. Vide : « Aucun ami
  validé pour le moment. »
- Les actions sont désactivées pendant qu'une demande est en cours (une seule à
  la fois) pour éviter de consommer le token rotatif deux fois de travers.

## États

| État | Affichage |
| --- | --- |
| Saisie vide / < 4 car. / caractère interdit | Aide explicative, bouton désactivé, aucune requête |
| Recherche en cours | `ActivityIndicator` + « Recherche en cours… » |
| 200 avec résultats | Lignes triées par pertinence, action selon `friendStatus` |
| 200 liste vide | « Aucun joueur ne correspond à cette recherche. » |
| Ajout réussi | Le bouton devient « En attente » localement |
| Serveur « Already friends » / « Friend request already exists » | Statut local aligné sur `friend` / `pending` + message |
| Onglet Amis : chargement | `ActivityIndicator` + « Chargement… » |
| Acceptation | Recharge demandes + amis (l'ami apparaît dans la liste) |
| Refus | La demande disparaît de la liste locale |
| Erreur API / réseau | Message d'erreur rouge |
| Session morte (`Invalid REQUEST TOKEN`) | Redirection connexion gérée dans `api.ts` |

## Navigation

- Entrée : menu latéral de la fenêtre principale (`{ nom: 'ecole' }` — identifiant
  ASCII, seul le libellé affiché porte l'accent « École ») ; rendu par `App.tsx`
  dans `FenetreAvecEntete titre="École"`. Une ressource graphique de saison
  (`batiments.*.fenetre`) peut aussi ouvrir cette fenêtre.
- Retour : chevron de l'en-tête (`retourner`), bouton système Android, bouton
  « avant » du navigateur web.
- Clic sur un **ami validé** (onglet Amis uniquement) → fenêtre `maison-visite`
  (cf. [maison-visite.md](./maison-visite.md)).
- La recherche, les demandes en attente et les résultats `friend` **ne
  naviguent jamais** vers une maison.

## Notes

- Identifiant ASCII : `ecole` partout dans le code (`Fenetre.nom`, `App.tsx`,
  menu latéral, `ZONES`, valeurs `fenetre` des saisons) ; « École » n'est qu'un
  texte affiché.
- `src/services/api.ts` : `rechercherUtilisateurs` valide la saisie, appelle
  `appelProtege('/users?value=' + valeur)` puis tronque à 5 (`USER_SEARCH_LIMIT`
  serveur = 6). `listerDemandesAmis`, `listerAmis`, `envoyerDemandeAmi`,
  `refuserDemandeAmi`, `listerCartesAmi` (liste) et `recupererCarteAmi`
  (une carte) encapsulent les routes `/friend/*`
  (contrat §5.13/§5.14 de `integration-client.md`).
- Les deux appels de l'onglet Amis sont lancés ensemble : `api.ts` les
  **sérialise** (file d'appels) car le couple de tokens est à usage unique.
- `ErreurApi.tokenRotate` : sur une erreur métier `/friend/*`, le serveur renvoie
  un nouveau `API_REQUEST_TOKEN` dans le corps — `api.ts` le stocke avant de
  relancer, sinon l'appel suivant déconnecterait l'utilisateur.
- Pas d'incrémentation de version pour ce contenu initial.
