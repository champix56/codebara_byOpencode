# Fenêtre Poste (messagerie & réception des cartes)

Fenêtre : `poste` — composant `src/components/poste-ecran.tsx`, rendu par `App.tsx` avec l'en-tête partagé. Entrées : menu latéral de la fenêtre principale, bâtiment de saison (`batiments.*.fenetre = poste`, résolu par `ZONES` dans `principal.tsx`) **et clic sur une notification système** (v0.0.16). L'identifiant `poste` est ASCII ; l'accent n'apparaît que dans le titre affiché « Poste ».

## Rôle

Messagerie du joueur (§5.15 du contrat serveur). Depuis le 2026-11-24, `POST /card` ne renvoie que l'id définitif : la génération se poursuit côté serveur (pool de threads, file JSON `content/card_tasks.json`, table miroir `card_awaiting_receipt`) puis dépose une notification. La Poste affiche ces notifications et impose un choix pour chaque carte achevée : **accepter** (nom optionnel) ou **refuser**.

## Structure visuelle

- Liste scrollable : **l'objet seul** de chaque notification est affiché (`notification.object`), sur une carte cliquable, précédé d'une icône (v0.0.19) : **œuf** pour une carte générée (`type = nouvelles cartes`), **croix rouge** pour un échec (`type = information`). Aucune date ni état dans la liste (contrat serveur).
- Vide : « Aucune notification pour le moment. » ; chargement : spinner vert.
- Ouverture d'une notification (`PUT /notifications/{id}` = marquer lue, puis `GET /notifications/{id}` = détail) → modal :
  - **carte achevée** (`type = nouvelles cartes`, état `achevé`) : visuel 3D (`visuel-carte.tsx`, largeur 180), titre « Carte #id », stats `datas.json` (santé / attaque / puissance), boutons **Accepter** et **Refuser**. « Accepter » ouvre un champ « Nom de la carte (facultatif) » + **Confirmer** / **Retour**. Aucun bouton Fermer.
  - **carte en échec** (`type = information`) : croix rouge, titre avec le numéro de la carte (objet envoyé par le serveur, même en échec), corps = motif réel renvoyé dans `notification.reason` (« Motif de l’échec : … ») ou message générique si absent, puis **Compris**.

## États

- `chargement` : `listerNotifications(idUser)` — avec session (tokens du store) ou, sans session, `GET /notifications` avec `{"iduser": N}` seul (aucun token renvoyé).
- Rafraîchissement automatique toutes les 30 s **uniquement si aucune modal n'est ouverte** ; le retour sur la fenêtre relance aussi le chargement.
- `selection = null` : liste ; `selection ≠ null` : détail en modal.
- Carte achevée : `definirBlocageRetour(true)` — retour de l'en-tête, bouton Android (`BackHandler`) et historique web (`historique-web.ts`) sont verrouillés jusqu'à acceptation/refus. Le verrou est relâché à la sortie de l'écran (`useEffect` cleanup) et sur `terminer()`.
- Acceptation : `POST /awaiting_cards/{id}` avec `name` optionnel → réponse `{cardid, card, checksum}` → `cdzDepuisBase64` + `ouvrirCdz` (vérification checksum) → `enregistrerCarte(<idUser>/<id>.cdz)` + `majIndex(nom, saison)` ; nom retenu = saisi ou `datas.json.name`.
- Refus : `DELETE /awaiting_cards/{id}` (supprime ligne miroir, `.cdz`, tâche JSON, notification) ; même chose automatiquement à l'ouverture d'une notification d'échec.
- Erreurs (archive illisible, réseau…) : message rouge ; l'archive illisible n'empêche pas l'acceptation/refus (le re-téléchargement se fait via la réponse POST). Garde-fous anti setState après démontage (`monte`).

## Notifications système (v0.0.16, arrière-plan v0.0.18)

Service global monté une seule fois dans `App.tsx` sous `PersistGate`
(`src/hooks/use-notifications-systeme.ts`, hook `useNotificationsSysteme`), indépendant de la fenêtre courante :

- Toutes les **30 s** quand l'app est active (`AppState` natif,
  `document.visibilityState` web) : `GET /notifications` avec la session si elle
  existe, sinon avec le dernier `iduser` persistant (stockage dédié
  `src/utils/dernier-utilisateur.ts`, hors tranche redux-persist purgée à la
  déconnexion).
- Ne sont présentées que les notifications dont `fetched` est faux : logo +
  nature (`type`) + objet, **jamais le corps** (checksum, fichier…). Après
  affichage, `PUT /notifications/{id}/fetched` est appelé — `state` (lu/non lu)
  n'est pas modifié, la Poste reste seule à décider.
- Mobile : `expo-notifications` (canal Android `codebara-notifications`, icône
  monochrome et couleur vert #43a047 dans `app.json`). Web : API `Notification`
  du navigateur + `public/service-worker.js`, sans changement d'URL.
- Depuis v0.0.18, quand l'app/onglet est fermé, une tâche native (mobile) ou le
  `periodicsync` du service worker (web) interroge le serveur avec le dernier
  `iduser` seul : **aucun token n'est envoyé ni consommé**. Les notifications
  affichées jouent un son et font vibrer. Détails et limites :
  [`notifications.md`](../notifications.md).
- Clic : session active → `poste` ; sinon tentative d'auto-connexion par tokens,
  puis `poste` si succès, `connexion` sinon. Le clic est une action explicite :
  il force le remplacement même si le retour est verrouillé par une carte en
  attente de choix.

## Navigation

- Entrée : menu latéral (« Poste »), bâtiment de saison de la carte principale ou clic notification système.
- Sortie : `retourner()` (en-tête / Android / historique web) — **bloqué tant qu'une carte achevée est affichée** ; sinon retour à la fenêtre précédente.
- Après acceptation ou refus : la notification disparaît de la liste (rechargement), la fenêtre reste ouverte.

## Notes

- Pas de router, pas d'URL : la fenêtre est pilotée uniquement par `src/navigation/navigateur.ts` (`naviguer`, `remplacer`, `retourner`, `definirBlocageRetour`).
- Le blocage est global au navigateur : `naviguer`/`remonter`/`retourner` sont inertes, `remplacer(..., true)` reste autorisé pour la déconnexion sur session expirée (`api.ts`).
- Migrations SQL à appliquer sur le serveur (dépôt pyCodebara2) : `migration-card-awaiting.sql` — tables `card_awaiting_receipt` et `notification` ; `migration-notification-fetched.sql` — colonne `notification.fetched` (script `migration_bdd.0.0.16.py`) ; `migration-notification-reason.sql` — colonne `notification.reason` (script `migration_bdd.0.0.19.py`, **non appliquée à la base vivante sans accord**).
