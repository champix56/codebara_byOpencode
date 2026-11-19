# Maison visitée (ami) — lecture seule

## Rôle

Afficher la maison d'un **ami validé** sans jamais la modifier. Le chargement se
fait en deux temps (contrat serveur §5.14) : `GET /friend/{id}/cards` renvoie la
**liste des cartes** (métadonnées seules), puis
`GET /friend/{iduser}/cards/{idcard}` renvoie **chaque carte de la liste**, une
par une, avec son `.cdz`. Le serveur vérifie l'amitié validée ET que la carte
appartient bien à l'ami. Les archives sont décodées **en mémoire uniquement** :
aucun fichier local, aucun renommage, aucune écriture côté serveur.

## Structure visuelle

- En-tête commun `EnteteEcran` : logo hauteur du texte + titre « Maison de
  <nickname> (visite) » + chevron de retour (ajouté par `App.tsx`) ; à droite
  pièce/valeur `1000` en bulle vert clair et avatar (initiales du nickname) →
  `mairie`.
- **Modal de chargement** (plein écran, fond translucide) tant que la maison se
  remplit : `ActivityIndicator`, titre « Chargement de la maison de
  <nickname> », état « Récupération de la liste des cartes… » puis « Carte 3 sur
  12 chargées… », barre de progression et rappel « Lecture seule — aucune carte
  n'est enregistrée sur l'appareil. »
- Banderole « Maison de <nickname> » avec rappel « Visite en lecture seule —
  aucune carte ne peut être modifiée. »
- Grille d'aperçus (3 colonnes en natif, 4 sur le web) : image `front.png` +
  nom incrusté (`deck.json`), nom et statistiques `P / S / A`. Une archive
  illisible reste affichée par son `#id`. Chaque cellule est cliquable.
- **Détail** (au clic sur une carte) : « ‹ Retour à la maison de <nickname> »,
  badge « Visite en lecture seule », image `perso`, nom, `#id`, visuel 3D
  `VisuelCarte` (front/back, rotation, zoom pincement), statistiques et
  capacités spéciales. Aucun bouton « ✎ », « Enregistrer » ou « Télécharger ».

## États

| État | Affichage |
| --- | --- |
| Liste en cours | Modal : « Récupération de la liste des cartes… » |
| Cartes en cours | Modal : « Carte N sur Total chargées… » + barre de progression |
| Liste vide | « <nickname> n'a pas encore de carte. » |
| 200 avec cartes | Grille d'aperçus (décodage séquentiel, une archive à la fois) |
| Erreur API / réseau / 404 Friend not found | Message d'erreur + bouton « Réessayer » |
| Une carte unitaire échoue (métier/404) | Les autres cartes chargent quand même ; message sous la grille avec les `#id` en échec |
| Réponse de carte perdue/avortée (mobile) | `recupererCarteAmi` réessaie **une fois** (grâce d'un token côté serveur) ; la maison se charge intégralement |
| Transfert interrompu après retry | Boucle arrêtée, cartes déjà chargées conservées, bandeau ambre « Transfert interrompu… Rouvre la maison pour reprendre. » — **pas** de fausse déconnexion |
| Détail en cours | Visuel 3D + stats en lecture seule ; retour à la grille |
| Archive corrompue au détail | Message d'erreur (contrôle `sha256 == cardHash` §6.3) |
| Session morte | Redirection connexion gérée dans `api.ts` |

## Navigation

- Entrée : **uniquement** depuis l'onglet « Amis » de l'école, au clic sur un ami
  validé → `naviguer({ nom: 'maison-visite', amiId, nickname })`.
- Jamais depuis la recherche générale (`/users`), même pour un `friendStatus:
  'friend'`.
- Retour : chevron de l'en-tête (`retourner`), bouton système Android, bouton
  « avant » web → école ; « ‹ Retour à la maison de … » dans le détail →
  simple retour à la grille (pas de dépilement).
- Aucun lien vers une autre fenêtre (`carte`, usine, mairie…) depuis cette
  maison.

## Notes

- `src/components/maison-visite-ecran.tsx` reçoit `amiId` et `nickname` portés
  par la fenêtre (type `Fenetre` dans `src/navigation/navigateur.ts`).
- `listerCartesAmi` lit la liste légère ; `recupererCarteAmi` est appelé en série
  pour chaque `id` reçu. Les appels protégés sont sérialisés dans `api.ts` (token
  rotatif), et le token renvoyé sur erreur `/friend/*` y est stocké avant de
  relancer l'erreur. Sur une `ErreurApi` de transport sans token roté (le serveur
  a consommé le couple mais la réponse ~1,9 Mo n'a pas été lue), un retry unique
  récupère le remplacement ; s'il échoue à son tour, la boucle s'arrête.
- **Interdit dans ce composant** : `lireCarteLocale`, `enregistrerCarte`,
  `majIndex` (`services/collection.ts`), `telechargerCarte` (`GET /card/{id}`),
  `renommerCarte` / `PUT /card/name`, et toute purge de cartes cassées. Les
  octets sont conservés dans une `useRef<Map>` le temps de la visite ; le
  démontage du composant les laisse au GC.
- `extraireApercu` (grille) saute les contrôles d'intégrité coûteux ;
  `ouvrirCdz(octets, cardHash)` (détail) valide le sha256 global et
  `hashs.json` **sur les octets déjà reçus** — aucun second appel réseau.
- Le timeout dédié de **120 s** ne s'applique qu'à la récupération d'une archive
  unitaire (≈1,9 Mo en base64) ; la liste, très légère, utilise le délai
  standard de 10 s.
- Le serveur ne purge rien non plus : une carte incomplète est omise de la
  réponse, pas détruite. Aucune incrémentation de version pour cette évolution.
