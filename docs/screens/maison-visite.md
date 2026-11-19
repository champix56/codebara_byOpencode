# Maison visitée (ami) — lecture seule

## Rôle

Afficher la maison d'un **ami validé** sans jamais la modifier. Les cartes sont
chargées depuis `GET /friend/{id}/cards` (contrat serveur §5.14) et décodées
**en mémoire uniquement** : aucun fichier local, aucun renommage, aucune écriture
côté serveur. Le serveur refuse l'accès aux inconnus et aux demandes en attente
(404 « Friend not found »).

## Structure visuelle

- En-tête commun `EnteteEcran` : titre « Maison de <nickname> (visite) » +
  chevron de retour (ajouté par `App.tsx`).
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
| Chargement | « Chargement des cartes de <nickname>… » |
| Liste vide | « <nickname> n'a pas encore de carte. » |
| 200 avec cartes | Grille d'aperçus (décodage séquentiel, une archive à la fois) |
| Erreur API / réseau / 404 Friend not found | Message d'erreur + bouton « Réessayer » |
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
- **Interdit dans ce composant** : `lireCarteLocale`, `enregistrerCarte`,
  `majIndex` (`services/collection.ts`), `telechargerCarte` (`GET /card/{id}`),
  `renommerCarte` / `PUT /card/name`, et toute purge de cartes cassées. Les
  octets sont conservés dans une `useRef<Map>` le temps de la visite ; le
  démontage du composant les laisse au GC.
- `extraireApercu` (grille) saute les contrôles d'intégrité coûteux ;
  `ouvrirCdz(octets, cardHash)` (détail) valide le sha256 global et
  `hashs.json` **sur les octets déjà reçus** — aucun second appel réseau.
- Le serveur ne purge rien non plus : une carte incomplète est omise de la
  réponse, pas détruite.
