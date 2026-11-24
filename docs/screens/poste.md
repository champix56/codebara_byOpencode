# Fenêtre Poste (messagerie & réception des cartes)

Fenêtre : `poste` — composant `src/components/poste-ecran.tsx`, rendu par `App.tsx` avec l'en-tête partagé. Entrées : menu latéral de la fenêtre principale **et** bâtiment de saison (`batiments.*.fenetre = poste`, résolu par `ZONES` dans `principal.tsx`). L'identifiant `poste` est ASCII ; l'accent n'apparaît que dans le titre affiché « Poste ».

## Rôle

Messagerie du joueur (§5.15 du contrat serveur). Depuis le 2026-11-24, `POST /card` ne renvoie que l'id définitif : la génération se poursuit côté serveur (pool de threads, file JSON `content/card_tasks.json`, table miroir `card_awaiting_receipt`) puis dépose une notification. La Poste affiche ces notifications et impose un choix pour chaque carte achevée : **accepter** (nom optionnel) ou **refuser**.

## Structure visuelle

- Liste scrollable : **l'objet seul** de chaque notification est affiché (`notification.object`), sur une carte cliquable. Aucune date, type ou état dans la liste (contrat serveur).
- Vide : « Aucune notification pour le moment. » ; chargement : spinner vert.
- Ouverture d'une notification (`PUT /notifications/{id}` = marquer lue, puis `GET /notifications/{id}` = détail) → modal :
  - **carte achevée** (`type = nouvelles cartes`, état `achevé`) : visuel 3D (`visuel-carte.tsx`, largeur 180), titre « Carte #id », stats `datas.json` (santé / attaque / puissance), boutons **Accepter** et **Refuser**. « Accepter » ouvre un champ « Nom de la carte (facultatif) » + **Confirmer** / **Retour**. Aucun bouton Fermer.
  - **carte en échec** (`type = information`) : message « Cette carte n'a pas pu être générée. Elle a été retirée de la file. » + **Compris**.

## États

- `chargement` : `listerNotifications(idUser)` — avec session (tokens du store) ou, sans session, `GET /notifications` avec `{"iduser": N}` seul (aucun token renvoyé).
- Rafraîchissement automatique toutes les 30 s **uniquement si aucune modal n'est ouverte** ; le retour sur la fenêtre relance aussi le chargement.
- `selection = null` : liste ; `selection ≠ null` : détail en modal.
- Carte achevée : `definirBlocageRetour(true)` — retour de l'en-tête, bouton Android (`BackHandler`) et historique web (`historique-web.ts`) sont verrouillés until acceptation/refus. Le verrou est relâché à la sortie de l'écran (`useEffect` cleanup) et sur `terminer()`.
- Acceptation : `POST /awaiting_cards/{id}` avec `name` optionnel → réponse `{cardid, card, checksum}` → `cdzDepuisBase64` + `ouvrirCdz` (vérification checksum) → `enregistrerCarte(<idUser>/<id>.cdz)` + `majIndex(nom, saison)` ; nom retenu = saisi ou `datas.json.name`.
- Refus : `DELETE /awaiting_cards/{id}` (supprime ligne miroir, `.cdz`, tâche JSON, notification) ; même chose automatiquement à l'ouverture d'une notification d'échec.
- Erreurs (archive illisible, réseau…) : message rouge ; l'archive illisible n'empêche pas l'acceptation/refus (le re-téléchargement se fait via la réponse POST). Garde-fous anti setState après démontage (`monte`).

## Navigation

- Entrée : menu latéral (« Poste ») ou bâtiment de saison de la carte principale.
- Sortie : `retourner()` (en-tête / Android / historique web) — **bloqué tant qu'une carte achevée est affichée** ; sinon retour à la fenêtre précédente.
- Après acceptation ou refus : la notification disparaît de la liste (rechargement), la fenêtre reste ouverte.

## Notes

- Pas de router, pas d'URL : la fenêtre est pilotée uniquement par `src/navigation/navigateur.ts` (`naviguer`, `remplacer`, `retourner`, `definirBlocageRetour`).
- Le blocage est global au navigateur : `naviguer`/`remonter`/`retourner` sont inertes, `remplacer(..., true)` reste autorisé pour la déconnexion sur session expirée (`api.ts`).
- Migration SQL à appliquer sur le serveur : `migration-card-awaiting.sql` (dépôt pyCodebara2) — tables `card_awaiting_receipt` et `notification`.
